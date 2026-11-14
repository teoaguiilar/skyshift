/*
 * SkyShift: bridge between the web and NASA/IPAC IRSA (Vercel serverless function).
 *
 * Browsers cannot read IRSA responses directly (IRSA sends no CORS headers),
 * so the web asks this function and it asks IRSA. It only talks to
 * irsa.ipac.caltech.edu, so nobody can use it to reach other sites.
 *
 * Two ways to call it:
 *
 *   1) Search: which SPHEREx images cover a point of the sky?
 *      GET /api/irsa?ra=269.452&dec=4.6933&band=D2&size=0.06   (size optional, default 0.06 deg)
 *      -> JSON { count, frames: [{ date, mjd, url }] } sorted by date.
 *         `url` is a cutout already centred on (ra, dec) with side `size` degrees.
 *
 *   2) Cutout: one SPHEREx image, ready for Aladin Lite.
 *      GET /api/irsa?cutout=<url from the search, URL-encoded>   (?url= also works)
 *      -> a small FITS file with only the IMAGE layer (zodiacal light already
 *         subtracted) as the primary HDU, keeping its sky WCS and SIP distortion.
 *         Extra facts about the centre of the cutout come in response headers:
 *           X-Wavelength-Um  central wavelength in microns (from the WCS-WAVE table)
 *           X-Bandwidth-Um   bandwidth in microns
 *           X-Flags          SPHEREx FLAGS bits OR-ed over the central 3x3 pixels
 *           X-Mjd-Avg        mid-exposure time (MJD)
 *           X-Date-Avg       mid-exposure time (ISO date)
 *         The same values are also written in the FITS header (SKY_WAVE, SKY_BW,
 *         SKY_FLAG).
 *
 * Wavelength: computed with the bilinear lookup table of the WCS-WAVE layer, as
 * described in the image header (FITS WCS Paper III, -TAB). It can differ by
 * about 0.3 % from astropy, which also applies the SIP terms to this table.
 *
 * Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
 * See AI_USAGE.md. Data: NASA/IPAC Infrared Science Archive (IRSA), SPHEREx.
 * License: MIT.
 */

const IRSA_HOST = 'irsa.ipac.caltech.edu'
const CUTOUT_PATH = '/ibe/data/spherex/'
const TAP_URL = `https://${IRSA_HOST}/TAP/sync`
const TIMEOUT_MS = 25000
const BLOCK = 2880

// ---------------------------------------------------------------------------
// Small FITS reader and writer (only what SPHEREx cutouts need)
// ---------------------------------------------------------------------------

function parseCard(card) {
  const key = card.slice(0, 8).trim()
  if (card.slice(8, 10) !== '= ') return { key, value: null }
  const rest = card.slice(10)
  let value
  if (rest.trimStart().startsWith("'")) {
    const m = rest.match(/'((?:[^']|'')*)'/)
    value = m ? m[1].replace(/''/g, "'").trimEnd() : ''
  } else {
    const raw = rest.split('/')[0].trim()
    if (raw === 'T') value = true
    else if (raw === 'F') value = false
    else value = Number(raw.replace('D', 'E'))
  }
  return { key, value }
}

export function readHdus(buffer) {
  const bytes = new Uint8Array(buffer)
  const text = new TextDecoder('latin1')
  const hdus = []
  let pos = 0
  while (pos + BLOCK <= bytes.length) {
    const cards = []
    const values = {}
    let ended = false
    while (!ended && pos + BLOCK <= bytes.length) {
      const block = text.decode(bytes.subarray(pos, pos + BLOCK))
      pos += BLOCK
      for (let i = 0; i < BLOCK; i += 80) {
        const card = block.slice(i, i + 80)
        cards.push(card)
        const { key, value } = parseCard(card)
        if (key === 'END') { ended = true; break }
        if (value !== null && !(key in values)) values[key] = value
      }
    }
    if (!ended) break
    const naxis = values.NAXIS || 0
    let size = 0
    if (naxis > 0) {
      size = Math.abs(values.BITPIX) / 8
      for (let i = 1; i <= naxis; i++) size *= values[`NAXIS${i}`]
      size = (size + (values.PCOUNT || 0)) * (values.GCOUNT || 1)
    }
    hdus.push({ cards, values, dataStart: pos, dataSize: size })
    pos += Math.ceil(size / BLOCK) * BLOCK
  }
  return hdus
}

function findHdu(hdus, name) {
  return hdus.find((h) => String(h.values.EXTNAME || '').trim().toUpperCase() === name)
}

function readFloat32Image(buffer, hdu) {
  const view = new DataView(buffer, hdu.dataStart, hdu.dataSize)
  const out = new Float32Array(hdu.dataSize / 4)
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, false)
  return out
}

function readInt32Image(buffer, hdu) {
  const view = new DataView(buffer, hdu.dataStart, hdu.dataSize)
  const out = new Int32Array(hdu.dataSize / 4)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt32(i * 4, false)
  return out
}

// Reads the single row of the WCS-WAVE binary table: columns X (nJ), Y (nJ), VALUES (mE).
function readWaveTable(buffer, hdu) {
  const v = hdu.values
  const view = new DataView(buffer, hdu.dataStart, hdu.dataSize)
  const cols = {}
  let offset = 0
  for (let c = 1; c <= v.TFIELDS; c++) {
    const name = String(v[`TTYPE${c}`]).trim()
    const form = String(v[`TFORM${c}`]).trim()
    const m = form.match(/^(\d*)([A-Z])$/)
    const count = m[1] ? Number(m[1]) : 1
    const type = m[2]
    const width = { J: 4, E: 4, D: 8, I: 2 }[type]
    if (!width) throw new Error(`Unsupported column type ${form}`)
    const arr = new Float64Array(count)
    for (let i = 0; i < count; i++) {
      const at = offset + i * width
      arr[i] = type === 'J' ? view.getInt32(at, false)
        : type === 'E' ? view.getFloat32(at, false)
          : type === 'D' ? view.getFloat64(at, false)
            : view.getInt16(at, false)
    }
    cols[name] = arr
    offset += count * width
  }
  return cols
}

// Fractional 0-based index of `psi` inside an increasing control-point list.
function fractionalIndex(points, psi) {
  let k = 0
  while (k < points.length - 2 && psi > points[k + 1]) k++
  return k + (psi - points[k]) / (points[k + 1] - points[k])
}

// Wavelength and bandwidth (microns) at 0-based pixel (x, y), from the 'W' WCS.
export function wavelengthAt(imageValues, table, x, y) {
  const h = imageValues
  const psi1 = (x + 1 - h.CRPIX1W) * (h.CDELT1W ?? 1) + (h.CRVAL1W ?? 0)
  const psi2 = (y + 1 - h.CRPIX2W) * (h.CDELT2W ?? 1) + (h.CRVAL2W ?? 0)
  const xs = table[String(h.PS1_2W || 'X').trim()]
  const ys = table[String(h.PS2_2W || 'Y').trim()]
  const values = table[String(h.PS1_1W || 'VALUES').trim()]
  const nx = xs.length
  const nm = values.length / (nx * ys.length) // outputs per control point (2)
  const u = fractionalIndex(xs, psi1)
  const v = fractionalIndex(ys, psi2)
  const i = Math.min(Math.max(Math.floor(u), 0), nx - 2)
  const j = Math.min(Math.max(Math.floor(v), 0), ys.length - 2)
  const fu = u - i
  const fv = v - j
  const at = (ii, jj, m) => values[m + nm * (ii + nx * jj)]
  const interp = (m) =>
    (1 - fu) * (1 - fv) * at(i, j, m) + fu * (1 - fv) * at(i + 1, j, m) +
    (1 - fu) * fv * at(i, j + 1, m) + fu * fv * at(i + 1, j + 1, m)
  const wl = (h.PV1_3W ?? 1) - 1
  const bw = (h.PV2_3W ?? 2) - 1
  return { wavelength: interp(wl), bandwidth: interp(bw) }
}

function card(key, value, comment = '') {
  let v
  if (typeof value === 'string') v = `'${value.replace(/'/g, "''").padEnd(8)}'`.padEnd(20)
  else if (typeof value === 'boolean') v = (value ? 'T' : 'F').padStart(20)
  else v = String(value).padStart(20)
  return `${key.padEnd(8)}= ${v}${comment ? ' / ' + comment : ''}`.slice(0, 80).padEnd(80)
}

// Builds a one-HDU FITS: the IMAGE header (as primary) + IMAGE - ZODI data.
export function buildImageFits(buffer) {
  const hdus = readHdus(buffer)
  const image = findHdu(hdus, 'IMAGE')
  if (!image) throw new Error('No IMAGE layer in this file')
  const zodi = findHdu(hdus, 'ZODI')
  const flagsHdu = findHdu(hdus, 'FLAGS')
  const waveHdu = findHdu(hdus, 'WCS-WAVE')

  const nx = image.values.NAXIS1
  const ny = image.values.NAXIS2
  const pixels = readFloat32Image(buffer, image)
  if (zodi) {
    const z = readFloat32Image(buffer, zodi)
    for (let i = 0; i < pixels.length; i++) pixels[i] -= z[i]
  }

  const cx = Math.round((nx - 1) / 2)
  const cy = Math.round((ny - 1) / 2)
  let wave = null
  if (waveHdu && image.values.CRPIX1W !== undefined) {
    wave = wavelengthAt(image.values, readWaveTable(buffer, waveHdu), cx, cy)
  }
  let flags = null
  if (flagsHdu) {
    const f = readInt32Image(buffer, flagsHdu)
    flags = 0
    for (let y = Math.max(cy - 1, 0); y <= Math.min(cy + 1, ny - 1); y++) {
      for (let x = Math.max(cx - 1, 0); x <= Math.min(cx + 1, nx - 1); x++) flags |= f[y * nx + x]
    }
  }

  // Header: the IMAGE header turned into a primary header.
  const skip = new Set(['XTENSION', 'PCOUNT', 'GCOUNT', 'END'])
  const cards = [card('SIMPLE', true, 'conforms to FITS standard')]
  for (const c of image.cards) {
    const key = c.slice(0, 8).trim()
    if (key === 'END') break
    if (skip.has(key)) continue
    cards.push(c)
  }
  if (wave) {
    cards.push(card('SKY_WAVE', Number(wave.wavelength.toFixed(5)), '[um] central wavelength at cutout centre'))
    cards.push(card('SKY_BW', Number(wave.bandwidth.toFixed(5)), '[um] bandwidth at cutout centre'))
  }
  if (flags !== null) cards.push(card('SKY_FLAG', flags, 'FLAGS OR-ed over central 3x3 pixels'))
  cards.push('HISTORY SkyShift bridge: IMAGE layer only, ZODI layer subtracted'.padEnd(80))
  cards.push('END'.padEnd(80))
  const headerText = cards.join('')
  const headerLen = Math.ceil(headerText.length / BLOCK) * BLOCK
  const dataLen = Math.ceil((pixels.length * 4) / BLOCK) * BLOCK

  const out = new Uint8Array(headerLen + dataLen)
  for (let i = 0; i < headerLen; i++) out[i] = i < headerText.length ? headerText.charCodeAt(i) : 32
  const view = new DataView(out.buffer, headerLen)
  for (let i = 0; i < pixels.length; i++) view.setFloat32(i * 4, pixels[i], false)

  return {
    fits: out,
    info: {
      wavelength: wave ? wave.wavelength : null,
      bandwidth: wave ? wave.bandwidth : null,
      flags,
      mjdAvg: image.values['MJD-AVG'] ?? null,
      dateAvg: image.values['DATE-AVG'] ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

async function irsaFetch(url, tries = 3) {
  // IRSA sometimes answers 503 for a moment: wait a little and try again.
  for (let attempt = 1; ; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const r = await fetch(url, { signal: ctrl.signal })
      if (r.ok) return r
      if (r.status < 500 || attempt >= tries) {
        throw Object.assign(new Error(`IRSA answered ${r.status}`), { status: 502 })
      }
    } finally {
      clearTimeout(timer)
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
  }
}

function fail(res, status, message) {
  res.status(status).json({ error: message })
}

async function search(params, res) {
  const ra = Number(params.get('ra'))
  const dec = Number(params.get('dec'))
  const band = String(params.get('band') || 'D2').toUpperCase()
  const size = Number(params.get('size') || 0.06)
  if (!(ra >= 0 && ra < 360) || !(dec >= -90 && dec <= 90)) return fail(res, 400, 'ra must be 0-360 and dec -90..90 (degrees)')
  if (!/^D[1-6]$/.test(band)) return fail(res, 400, 'band must be D1..D6')
  if (!(size >= 0.01 && size <= 0.5)) return fail(res, 400, 'size must be 0.01-0.5 degrees')

  const query = `SELECT a.uri, p.time_bounds_lower FROM spherex.artifact a
    JOIN spherex.plane p ON a.planeid = p.planeid
    WHERE 1 = CONTAINS(POINT('ICRS', ${ra}, ${dec}), p.poly)
      AND p.energy_bandpassname = 'SPHEREx-${band}'
    ORDER BY p.time_bounds_lower`
  const r = await irsaFetch(`${TAP_URL}?${new URLSearchParams({ QUERY: query, LANG: 'ADQL', FORMAT: 'csv' })}`)
  const lines = (await r.text()).trim().split(/\r?\n/).slice(1)
  const frames = lines.filter(Boolean).map((line) => {
    const [uri, mjd] = line.split(',').map((s) => s.replace(/^"|"$/g, ''))
    const m = Number(mjd)
    const date = new Date((m - 40587) * 86400000).toISOString().slice(0, 10)
    return { date, mjd: m, url: `https://${IRSA_HOST}/${uri}?center=${ra},${dec}d&size=${size}` }
  })
  res.setHeader('Cache-Control', 'public, s-maxage=3600')
  res.status(200).json({ ra, dec, band, size, count: frames.length, frames })
}

async function cutout(rawUrl, res) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return fail(res, 400, 'url is not a valid address')
  }
  if (url.protocol !== 'https:' || url.hostname !== IRSA_HOST || !url.pathname.startsWith(CUTOUT_PATH)) {
    return fail(res, 403, `Only SPHEREx files on https://${IRSA_HOST}${CUTOUT_PATH} are allowed`)
  }
  const r = await irsaFetch(url.toString())
  const { fits, info } = buildImageFits(await r.arrayBuffer())
  res.setHeader('Content-Type', 'application/fits')
  res.setHeader('Cache-Control', 'public, s-maxage=604800, immutable')
  if (info.wavelength !== null) res.setHeader('X-Wavelength-Um', info.wavelength.toFixed(5))
  if (info.bandwidth !== null) res.setHeader('X-Bandwidth-Um', info.bandwidth.toFixed(5))
  if (info.flags !== null) res.setHeader('X-Flags', String(info.flags))
  if (info.mjdAvg !== null) res.setHeader('X-Mjd-Avg', String(info.mjdAvg))
  if (info.dateAvg !== null) res.setHeader('X-Date-Avg', String(info.dateAvg))
  res.status(200).send(Buffer.from(fits))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Expose-Headers', 'X-Wavelength-Um, X-Bandwidth-Um, X-Flags, X-Mjd-Avg, X-Date-Avg')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return fail(res, 405, 'Only GET is allowed')

  const params = new URL(req.url, 'http://localhost').searchParams
  try {
    const target = params.get('cutout') || params.get('url')
    if (target) return await cutout(target, res)
    if (params.has('ra') && params.has('dec')) return await search(params, res)
    return fail(res, 400, 'Use ?ra=&dec=&band=&size= to search, or ?cutout= to get one image')
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : err.status || 500
    return fail(res, status, err.name === 'AbortError' ? 'IRSA took too long, try again' : err.message)
  }
}
