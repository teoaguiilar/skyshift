/*
 * SkyShift — read sky coordinates typed in the search box.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Accepts (anything else is treated as an object name):
 *   269.452 4.693  |  269.452, +4.693                  degrees (ICRS)
 *   17 57 48.5 +04 41 36  |  17:57:48.5 +04:41:36       hours/min/s and deg/arcmin/arcsec (ICRS)
 *   17h57m48.5s +04d41m36s  |  17h57m48.5s +04°41′36″
 *   17 57.8 +04 41.6                                    hours/min and deg/arcmin
 *   gal 31.01 14.06  |  l=31.01 b=14.06                 galactic l, b in degrees
 */
const D = Math.PI / 180
// ICRS -> Galactic rotation matrix (Hipparcos, ESA 1997, Vol. 1, Sect. 1.5.3); its transpose goes back.
const GAL = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
]
function rotate(m, lon, lat) {
  const v = [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)]
  const g = m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])
  let a = Math.atan2(g[1], g[0]) / D
  if (a < 0) a += 360
  return [a, Math.asin(Math.max(-1, Math.min(1, g[2]))) / D]
}
export const toGalactic = (ra, dec) => rotate(GAL, ra, dec)
export const fromGalactic = (l, b) => rotate(GAL[0].map((_, i) => GAL.map((r) => r[i])), l, b)

const NUM = /^[-+−]?\d+(?:\.\d+)?$/
const num = (t) => parseFloat(t.replace('−', '-'))

export function parseCoords(text) {
  let t = text.trim()
  if (!t) return null
  // Galactic: "gal 31 14", "galactic 31, 14", "l=31 b=14", "l 31 b 14"
  const g = t.match(/^(?:gal(?:actic)?\s*[:=]?\s*)([-+−]?\d+(?:\.\d+)?)[\s,]+([-+−]?\d+(?:\.\d+)?)$/i) ||
    t.match(/^l\s*[:=]?\s*([-+−]?\d+(?:\.\d+)?)[\s,]+b\s*[:=]?\s*([-+−]?\d+(?:\.\d+)?)$/i)
  if (g) {
    const l = num(g[1])
    const b = num(g[2])
    if (l < 0 || l >= 360 || b < -90 || b > 90) return null
    const [ra, dec] = fromGalactic(l, b)
    return { ra, dec }
  }
  const sexa = /[hms:°′″'"d]/i.test(t)
  t = t.replace(/[hHmMsSdD°′″'":,]/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = t.split(' ')
  if (!parts.every((p) => NUM.test(p))) return null
  // Split RA and Dec: Dec starts at the token with a sign, or at the middle.
  let k = parts.findIndex((p, i) => i > 0 && /^[-+−]/.test(p))
  if (k < 0) k = parts.length / 2
  const raP = parts.slice(0, k)
  const decP = parts.slice(k)
  if (raP.length !== decP.length || raP.length < 1 || raP.length > 3) return null
  let ra
  let dec
  if (raP.length === 1 && !sexa) {
    ra = num(raP[0])
    dec = num(decP[0])
  } else {
    if (raP.length === 1) return null // "17h +04d" alone is ambiguous
    const [h, m = 0, s = 0] = raP.map(num)
    const neg = /^[-−]/.test(decP[0])
    const [d, am = 0, as = 0] = decP.map((p) => Math.abs(num(p)))
    if (h >= 24 || m >= 60 || s >= 60 || am >= 60 || as >= 60) return null
    ra = (h + m / 60 + s / 3600) * 15
    dec = (neg ? -1 : 1) * (d + am / 60 + as / 3600)
  }
  if (!(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90)) return null
  return { ra, dec }
}
