/*
 * SkyShift — SPHEREx images for any point of the sky, built in the browser.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 *
 * 1. Ask our bridge (/api/irsa, by Teo) which SPHEREx images cover the point.
 * 2. Download the cutouts (FITS, only the IMAGE layer, zodiacal light removed).
 * 3. Keep the images taken at a similar wavelength (±2 %, as pipeline/fetch_object.py does).
 * 4. Put every image on the same north-up grid centred on the point, using each image's
 *    own WCS (TAN + SIP distortion), so stars line up and only real changes remain.
 * The result has the same shape as data/<object>/manifest.json, so the same player shows it.
 */

const PIXEL_SCALE_ARCSEC = 6.15
const GRID = 35 // pixels per side (same as the pipeline)
const WAVE_TOL = 0.02
const MAX_FRAMES = 30
const ENOUGH_FRAMES = 6 // stop early once this many similar-wavelength images span two epochs
const CONCURRENCY = 6
const DEG = Math.PI / 180

// SPHEREx Level 2 FLAGS bits (SPHEREx Explanatory Supplement, Table 16) — same table as the pipeline.
const FLAG_NAMES = {
  0: 'TRANSIENT', 1: 'OVERFLOW', 2: 'SUR_ERROR', 6: 'NONFUNC', 7: 'DICHROIC', 9: 'MISSING_DATA',
  10: 'HOT', 11: 'COLD', 12: 'FULLSAMPLE', 14: 'PHANMISS', 15: 'NONLINEAR', 17: 'PERSIST',
  19: 'OUTLIER', 20: 'CROSSTALK', 21: 'SOURCE', 22: 'GHOST', 23: 'GHOST_FPA', 24: 'GHOST_EXT',
  25: 'STREAK', 26: 'BLOOM', 27: 'SNOWBALL', 28: 'HALO', 29: 'SATELLITE_HALO',
}
const BAD_FLAGS = new Set(['NONFUNC', 'DICHROIC', 'MISSING_DATA', 'HOT', 'COLD', 'NONLINEAR', 'SATELLITE_HALO'])

function flagNames(value) {
  if (!Number.isFinite(value)) return []
  return Object.entries(FLAG_NAMES)
    .filter(([bit]) => (value >>> Number(bit)) & 1)
    .map(([, name]) => name)
}

// ---------------------------------------------------------------- FITS (single HDU, BITPIX -32)
function readFits(buffer) {
  const bytes = new Uint8Array(buffer)
  const dec = new TextDecoder('latin1')
  const h = {}
  let pos = 0
  let done = false
  while (!done && pos + 2880 <= bytes.length) {
    const block = dec.decode(bytes.subarray(pos, pos + 2880))
    pos += 2880
    for (let i = 0; i < 2880; i += 80) {
      const card = block.slice(i, i + 80)
      const key = card.slice(0, 8).trim()
      if (key === 'END') {
        done = true
        break
      }
      if (card.slice(8, 10) !== '= ') continue
      const raw = card.slice(10)
      if (raw.trimStart().startsWith("'")) {
        const m = raw.match(/'((?:[^']|'')*)'/)
        h[key] = m ? m[1].trim() : ''
      } else {
        const v = raw.split('/')[0].trim()
        h[key] = v === 'T' ? true : v === 'F' ? false : Number(v.replace('D', 'E'))
      }
    }
  }
  const nx = h.NAXIS1
  const ny = h.NAXIS2
  const view = new DataView(buffer, pos, nx * ny * 4)
  const data = new Float32Array(nx * ny)
  for (let i = 0; i < data.length; i++) data[i] = view.getFloat32(i * 4, false)
  return { h, nx, ny, data }
}

// ---------------------------------------------------------------- WCS: pixel (1-based) -> sky (deg)
function sip(h, prefix, u, v) {
  const order = h[`${prefix}_ORDER`]
  if (!order) return 0
  let s = 0
  for (let p = 0; p <= order; p++) {
    for (let q = 0; p + q <= order; q++) {
      const c = h[`${prefix}_${p}_${q}`]
      if (c) s += c * u ** p * v ** q
    }
  }
  return s
}

function pixToSky(h, x, y) {
  const u = x - h.CRPIX1
  const v = y - h.CRPIX2
  const up = u + sip(h, 'A', u, v)
  const vp = v + sip(h, 'B', u, v)
  const c1 = h.CDELT1 ?? 1
  const c2 = h.CDELT2 ?? 1
  const xi = (c1 * ((h.PC1_1 ?? h.CD1_1 ?? 1) * up + (h.PC1_2 ?? h.CD1_2 ?? 0) * vp)) * DEG
  const eta = (c2 * ((h.PC2_1 ?? h.CD2_1 ?? 0) * up + (h.PC2_2 ?? h.CD2_2 ?? 1) * vp)) * DEG
  // Gnomonic (TAN) de-projection around CRVAL (LONPOLE = 180).
  const a0 = h.CRVAL1 * DEG
  const d0 = h.CRVAL2 * DEG
  const D = Math.cos(d0) - eta * Math.sin(d0)
  const ra = a0 + Math.atan2(xi, D)
  const dec = Math.atan2((Math.sin(d0) + eta * Math.cos(d0)) * Math.cos(ra - a0), D)
  return [((ra / DEG) % 360 + 360) % 360, dec / DEG]
}

// Sky -> tangent plane around (ra0, dec0), in arcsec. x grows to the east, y to the north.
function skyToTangent(ra, dec, ra0, dec0) {
  const a = (ra - ra0) * DEG
  const d = dec * DEG
  const d0 = dec0 * DEG
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a)
  const x = (Math.cos(d) * Math.sin(a)) / cosc
  const y = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a)) / cosc
  return [x / DEG * 3600, y / DEG * 3600]
}

// Resample one image onto the common grid (north up, east left), bilinear.
// Locally (35 px) the full TAN+SIP mapping is replaced by its tangent-plane Jacobian,
// computed exactly at the pixel nearest the target; the error is far below 0.01 px.
function resample(img, ra0, dec0) {
  const { h, nx, ny, data } = img
  const cx = (nx + 1) / 2
  const cy = (ny + 1) / 2
  const p0 = skyToTangent(...pixToSky(h, cx, cy), ra0, dec0)
  const px = skyToTangent(...pixToSky(h, cx + 1, cy), ra0, dec0)
  const py = skyToTangent(...pixToSky(h, cx, cy + 1), ra0, dec0)
  const m = [px[0] - p0[0], py[0] - p0[0], px[1] - p0[1], py[1] - p0[1]] // d(tangent)/d(pixel)
  const det = m[0] * m[3] - m[1] * m[2]
  const inv = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det]

  const out = new Float32Array(GRID * GRID).fill(NaN)
  const half = (GRID - 1) / 2
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const east = (half - i) * PIXEL_SCALE_ARCSEC // east is left
      const north = (half - j) * PIXEL_SCALE_ARCSEC // north is up
      const dx = east - p0[0]
      const dy = north - p0[1]
      const x = cx + inv[0] * dx + inv[1] * dy - 1 // 0-based
      const y = cy + inv[2] * dx + inv[3] * dy - 1
      const x0 = Math.floor(x)
      const y0 = Math.floor(y)
      if (x0 < 0 || y0 < 0 || x0 + 1 >= nx || y0 + 1 >= ny) continue
      const fx = x - x0
      const fy = y - y0
      const v00 = data[y0 * nx + x0]
      const v10 = data[y0 * nx + x0 + 1]
      const v01 = data[(y0 + 1) * nx + x0]
      const v11 = data[(y0 + 1) * nx + x0 + 1]
      out[j * GRID + i] = (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy
    }
  }
  return out
}

// One brightness scale for all frames, so the animation does not flicker.
function makeStretch(images) {
  const all = []
  images.forEach((im) => im.forEach((v) => Number.isFinite(v) && all.push(v)))
  all.sort((a, b) => a - b)
  const q = (p) => all[Math.min(all.length - 1, Math.floor(p * all.length))] ?? 0
  const lo = q(0.05)
  const hi = q(0.997)
  const span = Math.max(hi - lo, 1e-6)
  const soft = 0.05
  const norm = Math.asinh(1 / soft)
  return (v) => (Number.isFinite(v) ? Math.asinh(Math.min(Math.max((v - lo) / span, 0), 1) / soft) / norm : null)
}

function toPng(values, stretch) {
  const canvas = document.createElement('canvas')
  canvas.width = GRID
  canvas.height = GRID
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(GRID, GRID)
  values.forEach((v, k) => {
    const s = stretch(v)
    const g = s === null ? 0 : Math.round(s * 255)
    img.data.set([g, g, g, s === null ? 0 : 255], k * 4)
  })
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

async function fetchWithRetry(url, tries = 2) { // the bridge already retries IRSA itself
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url)
      if (r.ok) return r
      if (t >= tries || r.status < 500) throw new Error(`HTTP ${r.status}`)
    } catch (e) {
      if (t >= tries) throw e
    }
    await new Promise((ok) => setTimeout(ok, 700 * t))
  }
}

// Download order that jumps across the whole time range, so two epochs arrive early.
function interleave(list) {
  const n = list.length
  const step = n > 7 ? 7 : 1
  const seen = new Set()
  const out = []
  for (let k = 0; out.length < n; k++) {
    let i = (k * step) % n
    while (seen.has(i)) i = (i + 1) % n
    seen.add(i)
    out.push(list[i])
  }
  return out
}

// Wavelength window (±2 %) with the most observing days, as in the pipeline.
function bestWindow(got) {
  const ok = got.filter((g) => Number.isFinite(g.wave))
  let best = null
  for (const g of ok) {
    const members = ok.filter((o) => Math.abs(o.wave - g.wave) <= WAVE_TOL * g.wave)
    const days = new Set(members.map((o) => o.meta.date)).size
    const span = Math.max(...members.map((o) => o.meta.mjd)) - Math.min(...members.map((o) => o.meta.mjd))
    if (!best || days > best.days || (days === best.days && members.length > best.members.length)) {
      best = { center: g.wave, members, days, span }
    }
  }
  return best
}

// Pick evenly spread frames when there are too many.
function spread(list, n) {
  if (list.length <= n) return list
  return Array.from({ length: n }, (_, k) => list[Math.round((k * (list.length - 1)) / (n - 1))])
}

export async function loadSpot(ra, dec, { band = 'D2', onProgress = () => {}, signal } = {}) {
  onProgress({ step: 'search' })
  const search = await (await fetchWithRetry(`/api/irsa?ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}&band=${band}`)).json()
  const wanted = interleave(spread(search.frames, MAX_FRAMES))
  if (wanted.length === 0) return { empty: true }

  let done = 0
  const got = []
  const queue = [...wanted]
  async function worker() {
    while (queue.length && !signal?.aborted) {
      const f = queue.shift()
      try {
        const r = await fetchWithRetry(`/api/irsa?cutout=${encodeURIComponent(f.url)}`)
        const wave = Number(r.headers.get('X-Wavelength-Um'))
        const flags = Number(r.headers.get('X-Flags'))
        const img = readFits(await r.arrayBuffer())
        got.push({ meta: f, wave, flags, img })
        const b = bestWindow(got)
        if (b && b.members.length >= ENOUGH_FRAMES && b.span > 30) queue.length = 0 // enough: stop early
      } catch {
        /* skip images IRSA could not deliver */
      }
      onProgress({ step: 'download', done: ++done, total: Math.max(done, done + queue.length) })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  if (signal?.aborted) return null

  const best = bestWindow(got)
  if (!best || best.days < 2) return { empty: true, downloaded: got.length }

  const chosen = best.members.sort((a, b) => a.meta.mjd - b.meta.mjd)
  const grids = chosen.map((g) => resample(g.img, ra, dec))
  const stretch = makeStretch(grids)

  return {
    object: 'spot',
    name: `RA ${ra.toFixed(4)}°, Dec ${dec.toFixed(4)}°`,
    band,
    wavelength_um: best.center,
    wavelength_tolerance: WAVE_TOL,
    grid: { center_ra_deg: ra, center_dec_deg: dec, pixel_scale_arcsec: PIXEL_SCALE_ARCSEC, width: GRID, height: GRID, png_upscale: 1 },
    data_credit: 'NASA SPHEREx via NASA/IPAC Infrared Science Archive (IRSA)',
    searched: search.count,
    downloaded: got.length,
    frames: chosen.map((g, k) => {
      const names = flagNames(g.flags)
      return {
        src: toPng(grids[k], stretch),
        date: g.meta.date,
        mjd: g.meta.mjd,
        wavelength_um: g.wave,
        quality_ok: !names.some((n) => BAD_FLAGS.has(n)),
        flags: names,
      }
    }),
  }
}
