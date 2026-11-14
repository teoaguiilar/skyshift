/*
 * SkyShift — small charts under the time-lapse: position vs time and brightness vs time.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Data: the `measured` / `predicted` fields of data/<object>/manifest.json (pipeline by Teo).
 */

const W = 340
const H = 150
const PAD = { l: 40, r: 10, t: 10, b: 24 }

function scale(v, a, b, A, B) {
  return b === a ? (A + B) / 2 : A + ((v - a) / (b - a)) * (B - A)
}

function Chart({ points, line, current, yLabel, legend }) {
  const ts = [...points.map((p) => p.t), ...(line || []).map((p) => p.t)]
  const ys = [...points.flatMap((p) => [p.y, p.lo ?? p.y, p.hi ?? p.y]), ...(line || []).map((p) => p.y)]
  const t0 = Math.min(...ts)
  const t1 = Math.max(...ts)
  let y0 = Math.min(...ys)
  let y1 = Math.max(...ys)
  const pad = (y1 - y0) * 0.12 || 1
  y0 -= pad
  y1 += pad
  const X = (t) => scale(t, t0, t1, PAD.l, W - PAD.r)
  const Y = (y) => scale(y, y0, y1, H - PAD.b, PAD.t)
  const date = (mjd) => new Date((mjd - 40587) * 86400000).toISOString().slice(0, 7)

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={yLabel}>
        <line className="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
        <line className="axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} />
        <text className="tick" x={PAD.l - 4} y={Y(y1 - pad) + 3} textAnchor="end">
          {(y1 - pad).toFixed(0)}
        </text>
        <text className="tick" x={PAD.l - 4} y={Y(y0 + pad) + 3} textAnchor="end">
          {(y0 + pad).toFixed(0)}
        </text>
        <text className="tick" x={PAD.l} y={H - 8}>
          {date(t0)}
        </text>
        <text className="tick" x={W - PAD.r} y={H - 8} textAnchor="end">
          {date(t1)}
        </text>
        {current != null && <line className="now" x1={X(current)} y1={PAD.t} x2={X(current)} y2={H - PAD.b} />}
        {line && line.length > 1 && (
          <polyline className="expected" points={line.map((p) => `${X(p.t)},${Y(p.y)}`).join(' ')} />
        )}
        {points.map((p, k) =>
          p.lo != null && p.hi - p.lo > 0 ? (
            <g key={`e${k}`} className="err">
              <line x1={X(p.t)} y1={Y(p.lo)} x2={X(p.t)} y2={Y(p.hi)} />
              <line x1={X(p.t) - 3} y1={Y(p.lo)} x2={X(p.t) + 3} y2={Y(p.lo)} />
              <line x1={X(p.t) - 3} y1={Y(p.hi)} x2={X(p.t) + 3} y2={Y(p.hi)} />
            </g>
          ) : null,
        )}
        {points.map((p, k) => (
          <circle key={k} className={p.hollow ? 'pt hollow' : 'pt'} cx={X(p.t)} cy={Y(p.y)} r="3.5" />
        ))}
      </svg>
      <figcaption>
        <span>{yLabel}</span>
        {legend && <span className="legend">{legend}</span>}
      </figcaption>
    </figure>
  )
}

// Images of the same visit (taken less than 3 days apart) become one point:
// the average, with a bar from the lowest to the highest value of that visit.
const VISIT_DAYS = 3
function byVisit(items) {
  const groups = []
  for (const it of [...items].sort((a, b) => a.t - b.t)) {
    const g = groups[groups.length - 1]
    if (g && it.t - g[0].t < VISIT_DAYS) g.push(it)
    else groups.push([it])
  }
  return groups.map((g) => {
    const ys = g.map((i) => i.y)
    return {
      t: g.reduce((s, i) => s + i.t, 0) / g.length,
      y: ys.reduce((s, v) => s + v, 0) / ys.length,
      lo: Math.min(...ys),
      hi: Math.max(...ys),
      n: g.length,
      hollow: g.every((i) => i.hollow),
    }
  })
}

// Offsets in arcsec (east, north) from a reference sky position.
function offset(p, ref) {
  const c = Math.cos((ref.dec_deg * Math.PI) / 180)
  return [(p.ra_deg - ref.ra_deg) * c * 3600, (p.dec_deg - ref.dec_deg) * 3600]
}

// Position along the direction the object is expected to move.
export function PositionChart({ frames, currentMjd }) {
  const usable = frames.filter((f) => f.predicted && f.measured?.ra_deg != null)
  if (usable.length < 2) return null
  const ref = usable[0].predicted
  const last = offset(usable[usable.length - 1].predicted, ref)
  const len = Math.hypot(last[0], last[1])
  if (len < 1) return null // the catalogue says it barely moves in this time
  const u = [last[0] / len, last[1] / len]
  const along = (p) => {
    const o = offset(p, ref)
    return o[0] * u[0] + o[1] * u[1]
  }
  const dir = Math.abs(u[1]) > Math.abs(u[0]) ? (u[1] > 0 ? 'north' : 'south') : u[0] > 0 ? 'east' : 'west'
  return (
    <Chart
      points={byVisit(usable.map((f) => ({ t: f.mjd, y: along(f.measured), hollow: f.detected === false })))}
      line={byVisit(usable.map((f) => ({ t: f.mjd, y: along(f.predicted) })))}
      current={currentMjd}
      yLabel={`Shift towards the ${dir} (arcsec)`}
      legend={
        <>
          <i className="dot" /> measured by SkyShift (SPHEREx), average per visit; bar = spread of its images{' '}
          <i className="dash" /> expected from catalogue motion
        </>
      }
    />
  )
}

// Relative brightness, only when the star is not saturated.
export function BrightnessChart({ frames, currentMjd }) {
  const usable = frames.filter((f) => f.measured?.flux_rel != null && !f.measured?.saturated)
  if (usable.length < 3) return null
  return (
    <Chart
      points={byVisit(usable.map((f) => ({ t: f.mjd, y: f.measured.flux_rel })))}
      current={currentMjd}
      yLabel="Relative brightness (SPHEREx)"
      legend={
        <>
          <i className="dot" /> average per visit; bar = spread of its images. Changes larger than the bars make it a
          candidate variable until checked
        </>
      }
    />
  )
}
