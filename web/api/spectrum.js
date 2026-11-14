/*
 * SkyShift: SPHEREx spectrum of ANY point of the sky, on the fly (Vercel serverless function).
 *
 * The challenge gives "extra kudos" to tools that generate spectra on the fly.
 * SPHEREx sees a slightly different infrared wavelength in each part of its six
 * detector arrays, so every image of a point measures its brightness at one
 * wavelength between 0.75 and 5 microns. This function:
 *   1. asks IRSA which SPHEREx images (all six detectors) cover the point,
 *   2. keeps one visit (images less than 30 days apart; by default the latest),
 *   3. downloads a tiny cutout of each image around the point,
 *   4. measures the light in a circle of 2 pixels minus the background in a
 *      ring of 4 to 7 pixels (same method as pipeline/spectrum.py), and reads
 *      the wavelength of that pixel from the WCS-WAVE layer,
 *   5. returns the list of (wavelength, flux) points and a binned spectrum.
 * Only the measurements travel to the browser, not the images.
 *
 *   GET /api/spectrum?ra=133.7863&dec=-7.2451            (latest visit)
 *   GET /api/spectrum?ra=...&dec=...&visit=first         (first visit)
 *   -> JSON with the same shape as data/<object>/spectrum.json:
 *      { ra, dec, visit, points: [{band, mjd, wavelength_um, flux_ujy, flux_err_ujy, flags}],
 *        binned: [{wavelength_um, flux_ujy, flux_err_ujy, n}], skipped, partial, method, data_credit }
 *
 * Limits: the point is taken at the centre of each cutout (IRSA centres the
 * cutout on the requested position to within half a pixel) and nudged to the
 * light peak when a source is clearly detected; there is no aperture
 * correction, so absolute fluxes are approximate and the shape is what
 * matters. Images with bad quality flags or saturated pixels are skipped. If
 * IRSA is slow, the function stops at its time budget and returns what it has
 * (partial: true).
 *
 * Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
 * See AI_USAGE.md. Data: NASA/IPAC Infrared Science Archive (IRSA), SPHEREx. License: MIT.
 */

import { readHdus, wavelengthAt } from './irsa.js'

const IRSA = 'https://irsa.ipac.caltech.edu'
const TAP_URL = `${IRSA}/TAP/sync`
const CUTOUT_DEG = 0.03 // about 18 x 18 pixels: enough for the 7-pixel background ring
const VISIT_GAP_DAYS = 30
const MAX_IMAGES = 120
const PARALLEL = 16
const BUDGET_MS = 50000 // stop starting new downloads after this
const FETCH_TIMEOUT_MS = 20000
const PIXEL_ARCSEC = 6.15
const TO_UJY = (PIXEL_ARCSEC / 206264.806) ** 2 * 1e12 // MJy/sr per pixel -> microjansky
const R_AP = 2
const R_IN = 4
const R_OUT = 7
// FLAGS bits that make a measurement unusable (SPHEREx Explanatory Supplement, Table 16):
// NONFUNC 6, DICHROIC 7, MISSING_DATA 9, HOT 10, COLD 11, NONLINEAR 15, SATELLITE_HALO 29
const BAD_BITS = [6, 7, 9, 10, 11, 15, 29].reduce((m, b) => m | (1 << b), 0)

function hdu(hdus, name) {
  return hdus.find((h) => String(h.values.EXTNAME || '').trim().toUpperCase() === name)
}

function floats(buffer, h) {
  const view = new DataView(buffer, h.dataStart, h.dataSize)
  const out = new Float32Array(h.dataSize / 4)
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, false)
  return out
}

function ints(buffer, h) {
  const view = new DataView(buffer, h.dataStart, h.dataSize)
  const out = new Int32Array(h.dataSize / 4)
  for (let i = 0; i < out.length; i++) out[i] = view.getInt32(i * 4, false)
  return out
}

// Same reader as in irsa.js (one-row binary table with the wavelength lookup).
function waveTable(buffer, h) {
  const v = h.values
  const view = new DataView(buffer, h.dataStart, h.dataSize)
  const cols = {}
  let offset = 0
  for (let c = 1; c <= v.TFIELDS; c++) {
    const name = String(v[`TTYPE${c}`]).trim()
    const m = String(v[`TFORM${c}`]).trim().match(/^(\d*)([A-Z])$/)
    const count = m[1] ? Number(m[1]) : 1
    const width = { J: 4, E: 4, D: 8, I: 2 }[m[2]]
    const arr = new Float64Array(count)
    for (let i = 0; i < count; i++) {
      const at = offset + i * width
      arr[i] = m[2] === 'J' ? view.getInt32(at, false) : m[2] === 'E' ? view.getFloat32(at, false)
        : m[2] === 'D' ? view.getFloat64(at, false) : view.getInt16(at, false)
    }
    cols[name] = arr
    offset += count * width
  }
  return cols
}

function median(a) {
  const s = Float64Array.from(a).sort()
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

// Measures one cutout. Returns a point, or { skip: reason }.
export function measure(buffer) {
  const hdus = readHdus(buffer)
  const image = hdu(hdus, 'IMAGE')
  if (!image) return { skip: 'no image' }
  const nx = image.values.NAXIS1
  const ny = image.values.NAXIS2
  const img = floats(buffer, image)
  const zodi = hdu(hdus, 'ZODI')
  if (zodi) {
    const z = floats(buffer, zodi)
    for (let i = 0; i < img.length; i++) img[i] -= z[i]
  }
  const flagsHdu = hdu(hdus, 'FLAGS')
  const flags = flagsHdu ? ints(buffer, flagsHdu) : null

  // Start at the cutout centre; background from the ring around it.
  let cx = (nx - 1) / 2
  let cy = (ny - 1) / 2
  const ringAt = (x0, y0) => {
    const vals = []
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const r2 = (x - x0) ** 2 + (y - y0) ** 2
        const v = img[y * nx + x]
        if (r2 >= R_IN ** 2 && r2 <= R_OUT ** 2 && Number.isFinite(v)) vals.push(v)
      }
    }
    return vals
  }
  let ring = ringAt(cx, cy)
  if (ring.length < 15) return { skip: 'cutout too small' }
  let bkg = median(ring)
  let sigma = 1.4826 * median(ring.map((v) => Math.abs(v - bkg)))

  // Nudge to the light peak if a source is clearly there (at most 1.5 pixels).
  let best = null
  for (let y = Math.ceil(cy - 1.5); y <= Math.floor(cy + 1.5); y++) {
    for (let x = Math.ceil(cx - 1.5); x <= Math.floor(cx + 1.5); x++) {
      const v = img[y * nx + x]
      if (Number.isFinite(v) && (!best || v > best.v)) best = { x, y, v }
    }
  }
  if (best && sigma > 0 && best.v - bkg > 5 * sigma) {
    let sw = 0, sx = 0, sy = 0
    for (let y = best.y - 1; y <= best.y + 1; y++) {
      for (let x = best.x - 1; x <= best.x + 1; x++) {
        const w = img[y * nx + x] - bkg
        if (Number.isFinite(w) && w > 0) { sw += w; sx += w * x; sy += w * y }
      }
    }
    if (sw > 0) {
      cx = sx / sw
      cy = sy / sw
      ring = ringAt(cx, cy)
      bkg = median(ring)
      sigma = 1.4826 * median(ring.map((v) => Math.abs(v - bkg)))
    }
  }

  let signal = 0
  let nAp = 0
  let flagOr = 0
  for (let y = Math.floor(cy - R_AP); y <= Math.ceil(cy + R_AP); y++) {
    for (let x = Math.floor(cx - R_AP); x <= Math.ceil(cx + R_AP); x++) {
      if (x < 0 || y < 0 || x >= nx || y >= ny) continue
      if ((x - cx) ** 2 + (y - cy) ** 2 > R_AP ** 2) continue
      const v = img[y * nx + x]
      if (!Number.isFinite(v)) return { skip: 'saturated' }
      signal += v - bkg
      nAp++
      if (flags) flagOr |= flags[y * nx + x]
    }
  }
  if (flagOr & BAD_BITS) return { skip: 'bad quality flags' }

  const waveHdu = hdu(hdus, 'WCS-WAVE')
  if (!waveHdu || image.values.CRPIX1W === undefined) return { skip: 'no wavelength table' }
  const wave = wavelengthAt(image.values, waveTable(buffer, waveHdu), Math.round(cx), Math.round(cy))
  const band = String(image.values.DETECTOR ?? image.values.BAND ?? '').trim()

  return {
    band: band ? (band.startsWith('D') ? band : `D${band}`) : null,
    mjd: image.values['MJD-AVG'] ?? null,
    wavelength_um: Number(wave.wavelength.toFixed(4)),
    flux_ujy: Number((signal * TO_UJY).toFixed(2)),
    flux_err_ujy: Number((sigma * Math.sqrt(nAp) * TO_UJY).toFixed(2)),
    flags: flagOr,
  }
}

// Median flux in bins of constant width in log(wavelength), as in pipeline/spectrum.py.
export function binned(points, step = 0.02) {
  const out = []
  for (let lo = Math.log(0.7); lo < Math.log(5.1); lo += step) {
    const sel = points.filter((p) => Math.log(p.wavelength_um) >= lo && Math.log(p.wavelength_um) < lo + step)
    if (!sel.length) continue
    const fl = sel.map((p) => p.flux_ujy)
    const m = median(fl)
    const sd = Math.sqrt(fl.reduce((s, v) => s + (v - fl.reduce((a, b) => a + b, 0) / fl.length) ** 2, 0) / fl.length)
    out.push({
      wavelength_um: Number(median(sel.map((p) => p.wavelength_um)).toFixed(4)),
      flux_ujy: Number(m.toFixed(2)),
      flux_err_ujy: sel.length > 1 ? Number((1.2533 * sd / Math.sqrt(sel.length)).toFixed(2)) : null,
      n: sel.length,
    })
  }
  return out
}

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    try {
      const r = await fetch(url, { signal: ctrl.signal })
      if (r.ok) return r
      if (r.status < 500 || attempt >= 2) throw Object.assign(new Error(`IRSA answered ${r.status}`), { status: 502 })
    } finally {
      clearTimeout(timer)
    }
    await new Promise((resolve) => setTimeout(resolve, 800))
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET is allowed' })
  const started = Date.now()
  const params = new URL(req.url, 'http://localhost').searchParams
  const ra = Number(params.get('ra'))
  const dec = Number(params.get('dec'))
  const which = String(params.get('visit') || 'latest')
  if (!(ra >= 0 && ra < 360) || !(dec >= -90 && dec <= 90)) {
    return res.status(400).json({ error: 'ra must be 0-360 and dec -90..90 (degrees)' })
  }
  try {
    // 1. All SPHEREx images (six detectors) that cover the point.
    const query = `SELECT a.uri, p.time_bounds_lower, p.energy_bandpassname FROM spherex.artifact a
      JOIN spherex.plane p ON a.planeid = p.planeid
      WHERE 1 = CONTAINS(POINT('ICRS', ${ra}, ${dec}), p.poly)
      ORDER BY p.time_bounds_lower`
    const r = await get(`${TAP_URL}?${new URLSearchParams({ QUERY: query, LANG: 'ADQL', FORMAT: 'csv' })}`)
    const rows = (await r.text()).trim().split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
      const [uri, mjd, band] = line.split(',').map((s) => s.replace(/^"|"$/g, ''))
      return { uri, mjd: Number(mjd), band: band.replace('SPHEREx-', '') }
    })
    if (!rows.length) return res.status(200).json({ ra, dec, count: 0, points: [], binned: [], note: 'SPHEREx has no images of this point yet' })

    // 2. Group into visits and keep one.
    const visits = []
    for (const row of rows) {
      const last = visits[visits.length - 1]
      if (last && row.mjd - last[last.length - 1].mjd <= VISIT_GAP_DAYS) last.push(row)
      else visits.push([row])
    }
    const visit = which === 'first' ? visits[0] : visits[visits.length - 1]
    const step = Math.max(1, visit.length / MAX_IMAGES)
    const chosen = []
    for (let i = 0; i < visit.length && chosen.length < MAX_IMAGES; i += step) chosen.push(visit[Math.floor(i)])

    // 3-4. Download tiny cutouts in parallel and measure each one.
    const points = []
    const skipped = {}
    let next = 0
    let partial = false
    async function worker() {
      while (next < chosen.length) {
        if (Date.now() - started > BUDGET_MS) { partial = true; return }
        const row = chosen[next++]
        try {
          const c = await get(`${IRSA}/${row.uri}?center=${ra},${dec}d&size=${CUTOUT_DEG}`)
          const p = measure(await c.arrayBuffer())
          if (p.skip) skipped[p.skip] = (skipped[p.skip] || 0) + 1
          else points.push({ ...p, band: p.band || row.band, mjd: p.mjd ?? row.mjd })
        } catch {
          skipped['download failed'] = (skipped['download failed'] || 0) + 1
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker))
    points.sort((a, b) => a.wavelength_um - b.wavelength_um)

    const toDate = (m) => new Date((m - 40587) * 86400000).toISOString().slice(0, 10)
    res.setHeader('Cache-Control', partial ? 'no-store' : 'public, s-maxage=86400')
    return res.status(200).json({
      ra,
      dec,
      visit: { which, from: toDate(visit[0].mjd), to: toDate(visit[visit.length - 1].mjd), images_in_visit: visit.length, visits_available: visits.length },
      count: points.length,
      skipped,
      partial,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      units: { wavelength: 'micrometre', flux: 'microjansky' },
      method: 'On the fly: aperture photometry (radius 2 px = 12.3 arcsec, background ring 4-7 px) on every SPHEREx image of one visit, all six detector arrays; wavelength of the measured pixel from the WCS-WAVE layer. No aperture correction: absolute fluxes are approximate, the shape is what matters. A moving object is measured where it is at the cutout centre.',
      binned: binned(points),
      points,
      data_credit: 'NASA SPHEREx via NASA/IPAC Infrared Science Archive (IRSA)',
    })
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : err.status || 500
    return res.status(status).json({ error: err.name === 'AbortError' ? 'IRSA took too long, try again' : err.message })
  }
}
