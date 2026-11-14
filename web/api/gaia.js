/*
 * SkyShift: Gaia DR3 stars around a point of the sky (Vercel serverless function).
 *
 * Browsers cannot read the ESA Gaia Archive directly (no CORS headers), and the CDS
 * VizieR mirror is unreliable today, so the web asks this function and it asks ESA.
 * It only talks to the ESA Gaia Archive TAP service.
 *
 *   GET /api/gaia?ra=269.452&dec=4.693&r=0.2      (r = radius in degrees, max 0.5)
 *   -> JSON { ra, dec, r, epoch: 2016.0, count, stars: [[ra, dec, pmra, pmdec, g], ...] }
 *      pmra/pmdec in mas/yr (pmra includes cos(dec)), g = Gaia G magnitude.
 *      Positions are at the Gaia DR3 epoch (2016.0); the web moves them to the
 *      SPHEREx epoch using the proper motion.
 *
 * Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
 * See AI_USAGE.md. Data: ESA Gaia DR3 (Gaia Collaboration 2023). License: MIT.
 */

const TAP_URL = 'https://gea.esac.esa.int/tap-server/tap/sync'
const TIMEOUT_MS = 9000
const MAX_STARS = 3000

function fail(res, status, message) {
  res.status(status).json({ error: message })
}

export default async function handler(req, res) {
  const ra = Number(req.query.ra)
  const dec = Number(req.query.dec)
  const r = Math.min(Number(req.query.r) || 0.2, 0.5)
  if (!(ra >= 0 && ra < 360) || !(dec >= -90 && dec <= 90) || !(r > 0)) {
    return fail(res, 400, 'Use ?ra=<deg>&dec=<deg>&r=<deg, max 0.5>')
  }

  const adql =
    `SELECT TOP ${MAX_STARS} ra, dec, pmra, pmdec, phot_g_mean_mag ` +
    `FROM gaiadr3.gaia_source ` +
    `WHERE 1 = CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra.toFixed(6)}, ${dec.toFixed(6)}, ${r.toFixed(4)})) ` +
    `ORDER BY phot_g_mean_mag`
  const url = `${TAP_URL}?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=${encodeURIComponent(adql)}`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r2 = await fetch(url, { signal: ctrl.signal })
    if (!r2.ok) return fail(res, 502, `Gaia archive answered ${r2.status}`)
    const json = await r2.json()
    const stars = (json.data || []).map((row) => row.map((v) => (v === null ? null : Number(v))))
    res.setHeader('Cache-Control', 'public, s-maxage=86400')
    res.status(200).json({ ra, dec, r, epoch: 2016.0, count: stars.length, stars })
  } catch (e) {
    fail(res, 504, e.name === 'AbortError' ? 'Gaia archive did not answer in time' : 'Gaia archive unreachable')
  } finally {
    clearTimeout(timer)
  }
}
