/*
 * SkyShift — small charts under the time-lapse: position vs time and brightness vs time.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Data: the `measured` / `predicted` fields of data/<object>/manifest.json (pipeline by Teo).
 */
import { useState } from 'react'
import { t } from './i18n.js'

const W = 340
const H = 150
const PAD = { l: 52, r: 10, t: 10, b: 24 }

function scale(v, a, b, A, B) {
  return b === a ? (A + B) / 2 : A + ((v - a) / (b - a)) * (B - A)
}

function Chart({ points, raw, line, current, yLabel, legend, xFormat, yFormat, yRange }) {
  const ts = [...points.map((p) => p.t), ...(raw || []).map((p) => p.t), ...(line || []).map((p) => p.t)]
  const ys = [
    ...points.flatMap((p) => [p.y, p.lo ?? p.y, p.hi ?? p.y]),
    ...(raw || []).map((p) => p.y),
    ...(line || []).map((p) => p.y),
  ]
  const t0 = Math.min(...ts)
  const t1 = Math.max(...ts)
  let y0 = Math.min(...ys)
  let y1 = Math.max(...ys)
  let pad = (y1 - y0) * 0.12 || 1
  y0 -= pad
  y1 += pad
  if (yRange) {
    // Fixed y range given by the caller (e.g. the spectrum); whatever falls outside is cut off.
    ;[y0, y1] = yRange
    pad = 0
  }
  const clipId = `clip-${Math.round(Math.random() * 1e9)}`
  const X = (t) => scale(t, t0, t1, PAD.l, W - PAD.r)
  const Y = (y) => scale(y, y0, y1, H - PAD.b, PAD.t)
  const date = xFormat ?? ((mjd) => new Date((mjd - 40587) * 86400000).toISOString().slice(0, 7))
  const yf = yFormat ?? ((v) => v.toFixed(0))

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={yLabel}>
        <line className="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
        <line className="axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} />
        <text className="tick" x={PAD.l - 4} y={Y(y1 - pad) + 3} textAnchor="end">
          {yf(y1 - pad)}
        </text>
        <text className="tick" x={PAD.l - 4} y={Y(y0 + pad) + 3} textAnchor="end">
          {yf(y0 + pad)}
        </text>
        <text className="tick" x={PAD.l} y={H - 8}>
          {date(t0)}
        </text>
        <text className="tick" x={W - PAD.r} y={H - 8} textAnchor="end">
          {date(t1)}
        </text>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
        {current != null && <line className="now" x1={X(current)} y1={PAD.t} x2={X(current)} y2={H - PAD.b} />}
        {line && line.length > 1 && (
          <polyline className="expected" points={line.map((p) => `${X(p.t)},${Y(p.y)}`).join(' ')} />
        )}
        {(raw || []).map((p, k) => (
          <circle key={`r${k}`} className="raw" cx={X(p.t)} cy={Y(p.y)} r="1.8" />
        ))}
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
        </g>
      </svg>
      <figcaption>
        <span>{yLabel}</span>
        {legend && <span className="legend">{legend}</span>}
      </figcaption>
    </figure>
  )
}

// Visits = groups of images separated by more than 30 days (as in the pipeline plots).
// Each visit becomes one point: the mean, with an error bar = standard deviation / sqrt(n)
// (idea of Juan). The single images are drawn small and grey behind.
const VISIT_GAP_DAYS = 30
export function byVisit(items) {
  const sorted = [...items].sort((a, b) => a.t - b.t)
  const groups = []
  for (const it of sorted) {
    const g = groups[groups.length - 1]
    if (g && it.t - g[g.length - 1].t <= VISIT_GAP_DAYS) g.push(it)
    else groups.push([it])
  }
  return groups.map((g) => {
    const ys = g.map((i) => i.y)
    const n = ys.length
    const mean = ys.reduce((s, v) => s + v, 0) / n
    const sd = n > 1 ? Math.sqrt(ys.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0
    const se = n > 1 ? sd / Math.sqrt(n) : null
    return {
      t: g.reduce((s, i) => s + i.t, 0) / n,
      y: mean,
      lo: se != null ? mean - se : null,
      hi: se != null ? mean + se : null,
      n,
      hollow: g.every((i) => i.hollow),
    }
  })
}

// Offsets in arcsec (east, north) from a reference sky position.
function offset(p, ref) {
  const c = Math.cos((ref.dec_deg * Math.PI) / 180)
  return [(p.ra_deg - ref.ra_deg) * c * 3600, (p.dec_deg - ref.dec_deg) * 3600]
}

export const hasPosition = (frames) => {
  const u = frames.filter((f) => f.predicted && f.measured?.ra_deg != null)
  return u.length >= 2
}
export const hasBrightness = (frames) =>
  frames.filter((f) => f.measured?.flux_rel != null && !f.measured?.saturated).length >= 3

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
      raw={usable.map((f) => ({ t: f.mjd, y: along(f.measured) }))}
      line={byVisit(usable.map((f) => ({ t: f.mjd, y: along(f.predicted) })))}
      current={currentMjd}
      yLabel={t('Shift towards the {dir} (arcsec)', { dir: t(dir) })}
      legend={
        <>
          <span className="legend-row">
            <i className="dot" /> {t('Measured by SkyShift (SPHEREx): mean per visit ± standard error')}
          </span>
          <span className="legend-row">
            <i className="dot grey" /> {t('Single SPHEREx images')}
          </span>
          <span className="legend-row">
            <i className="dash" /> {t('Expected from the catalogue motion')}
          </span>
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
      raw={usable.map((f) => ({ t: f.mjd, y: f.measured.flux_rel }))}
      current={currentMjd}
      yLabel={t('Relative brightness (SPHEREx)')}
      legend={
        <>
          <span className="legend-row">
            <i className="dot" /> {t('Mean per visit ± standard error')}
          </span>
          <span className="legend-row">
            <i className="dot grey" /> {t('Single SPHEREx images')}
          </span>
          <span className="legend-row muted">{t('Changes much larger than the bars make it a candidate variable until checked.')}</span>
        </>
      }
    />
  )
}

const fmtFlux = (v) =>
  Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} Jy` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(1)} mJy` : `${v.toFixed(0)} µJy`

// Spectrum: SPHEREx brightness at each wavelength (binned), from data/<object>/spectrum.json.
export function SpectrumChart({ spectrum, note, filtered = false }) {
  const pts = (spectrum?.binned ?? []).filter((b) => Number.isFinite(b.flux_ujy))
  if (pts.length < 3) return null
  const range = spectrum.filter?.range_um
  return (
    <Chart
      points={pts.map((b) => ({
        t: b.wavelength_um,
        y: b.flux_ujy,
        lo: b.flux_err_ujy != null ? b.flux_ujy - b.flux_err_ujy : null,
        hi: b.flux_err_ujy != null ? b.flux_ujy + b.flux_err_ujy : null,
      }))}
      xFormat={(um) => `${um.toFixed(2)} µm`}
      yFormat={fmtFlux}
      yLabel={
        filtered && range
          ? t('Spectrum, filtered: only {a}–{b} µm (SPHEREx)', { a: range[0].toFixed(1), b: range[1].toFixed(1) })
          : t('Spectrum: brightness at each colour (SPHEREx, 0.75–5 µm)')
      }
      legend={
        <>
          <i className="dot" /> {t('SPHEREx images averaged by wavelength; bar = uncertainty. Absolute values are approximate.')}
          {spectrum.saturated_images_skipped > 0 && ` ${t('{n} saturated images left out.', { n: spectrum.saturated_images_skipped })}`}
          {note && ` ${note}`}
        </>
      }
    />
  )
}

// "Filtering" (WISE 0855): keeps only the long wavelengths, where the cold brown dwarf shines and the
// hot background star next to it matters less. Data: data/<obj>/spectrum_filtered.json (Teo, idea of Benjamín).
export function FilteredSpectrum({ spectrum, filtered, note }) {
  const [on, setOn] = useState(true) // the filtered view first: below 3.8 µm a background star contaminates it
  const f = filtered?.filter
  if (!f || !(filtered.binned?.length > 2)) return <SpectrumChart spectrum={spectrum} note={note} />
  const medians = Object.entries(f.median_flux_ujy ?? {})
  return (
    <div className="filtered-spectrum">
      <div className="seg small" role="group" aria-label={t('Spectrum view')}>
        <button className={on ? '' : 'on'} onClick={() => setOn(false)}>
          {t('All wavelengths')}
        </button>
        <button className={on ? 'on' : ''} onClick={() => setOn(true)}>
          {t('Filtering: {a}–{b} µm', { a: f.range_um[0].toFixed(1), b: f.range_um[1].toFixed(1) })}
        </button>
      </div>
      {on ? <SpectrumChart spectrum={filtered} filtered note={note} /> : <SpectrumChart spectrum={spectrum} note={note} />}
      {on && (
        <div className="filter-info">
          <p>{t(f.why)}</p>
          <p className="muted">
            {t('Detectors {d} · {k} images kept, {l} left out.', {
              d: (f.detectors ?? []).join(', '),
              k: f.kept_images,
              l: f.left_out_images,
            })}
            {medians.length > 0 &&
              ` ${t('Median brightness')}: ${medians
                .map(([band, v]) => `${band.replace('_um', ' µm').replace('-', '–')} → ${fmtFlux(v)}`)
                .join(' · ')}.`}
          </p>
        </div>
      )}
    </div>
  )
}
