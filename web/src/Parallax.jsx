/*
 * SkyShift — "Parallax": the yearly wobble of a star seen from the moving Earth, plus its proper motion.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 *
 * Data: proper motion (μα*, μδ) and parallax (ϖ) of each object from its manifest.json (pipeline by Teo,
 * values from SIMBAD via CDS Sesame). Earth's position: low-precision formula for the Sun from the
 * Astronomical Almanac (accurate to about 0.01°, far below what this drawing can show).
 *
 * Equations (ϖ in mas, X, Y, Z = Earth's position around the Sun in AU, equatorial axes):
 *   proper motion:  Δα·cosδ = μα*·Δt          Δδ = μδ·Δt
 *   parallax:       Δα·cosδ = ϖ (X sinα − Y cosα)
 *                   Δδ      = ϖ (X cosα sinδ + Y sinα sinδ − Z cosδ)
 * (The parallax lines follow from looking at the star from the Earth at position (X, Y, Z) instead of
 * from the Sun: the star's direction shifts by −ϖ times the part of (X, Y, Z) perpendicular to it.)
 */
import { useEffect, useMemo, useState } from 'react'
import { getLang, t as tr } from './i18n.js'

const D = Math.PI / 180

// Earth's heliocentric position (AU, equatorial) at a given decimal year.
// Sun's geocentric position from the Astronomical Almanac's low-precision formulas; Earth = −Sun.
export function earthXYZ(year) {
  const n = (year - 2000) * 365.25 // days from J2000.0 (JD 2451545.0)
  const L = 280.46 + 0.9856474 * n
  const g = (357.528 + 0.9856003 * n) * D
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D
  const R = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)
  const eps = (23.439 - 0.0000004 * n) * D
  return [-R * Math.cos(lambda), -R * Math.cos(eps) * Math.sin(lambda), -R * Math.sin(eps) * Math.sin(lambda)]
}

// Parallax shift (mas) of a star at (ra, dec) degrees with parallax plx (mas), at a decimal year.
export function parallaxShift(ra, dec, plx, year) {
  const [X, Y, Z] = earthXYZ(year)
  const a = ra * D
  const d = dec * D
  return [
    plx * (X * Math.sin(a) - Y * Math.cos(a)), // Δα·cosδ (towards east)
    plx * (X * Math.cos(a) * Math.sin(d) + Y * Math.sin(a) * Math.sin(d) - Z * Math.cos(d)), // Δδ (towards north)
  ]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmt = (v, n = 1) => (Number.isFinite(v) ? v.toFixed(n) : '—')

// Notes on what this simple model leaves out, per object (agreed with the science team).
const EXTRA = {
  'eps-indi-b':
    'Epsilon Indi B is a pair (Ba and Bb) orbiting each other, so their combined light also wobbles with that orbit (Chen et al. 2022). That extra motion is not drawn: our data do not include the orbit.',
}

// RW Aurigae: the team does not use the SIMBAD parallax (15.42 ± 3.69 mas: 24 % error, and RW Aur is a
// double star, which spoils the measurement). Its parallax is taken from the distance in its science card.
const LY_PER_PC = 3.26156
export function plxFromCard(card) {
  const f = card?.facts?.find((x) => /distance/i.test(x.label) && /light/i.test(x.unit ?? ''))
  const ly = f ? parseFloat(String(f.value).replace(/,/g, '')) : NaN
  return Number.isFinite(ly) && ly > 0 ? { plx: (1000 * LY_PER_PC) / ly, text: `${tr(String(f.value))} ${tr(f.unit)}`, source: tr(f.source) } : null
}

// Parallax (mas) the team uses for an object: the card distance for RW Aurigae, otherwise the manifest value.
export function usedParallax(cardId, target, card) {
  if (cardId === 'rw-aurigae') return plxFromCard(card)?.plx ?? null
  return Number.isFinite(target?.parallax_mas) ? target.parallax_mas : null
}

// A small square plot. pts: [[east, north], ...] in the given unit; east is drawn to the LEFT, as on the sky.
function Plot({ pts, dot, unit, title }) {
  const W = 300
  const H = 170
  const pad = 26
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9) * 1.15
  const k = Math.min(W - 2 * pad, H - 2 * pad) / span
  const sx = (e) => W / 2 - (e - cx) * k // east to the left
  const sy = (n) => H / 2 - (n - cy) * k // north up
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('')
  // scale bar: a round number about a quarter of the span
  const raw = span / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const bar = [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? raw
  return (
    <figure className="chart plx-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <path d={path} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
        {dot && <circle cx={sx(dot[0])} cy={sy(dot[1])} r="5" className="pt" />}
        <line x1={W - pad - bar * k} y1={H - 10} x2={W - pad} y2={H - 10} stroke="var(--muted)" strokeWidth="1.5" />
        <text x={W - pad} y={H - 14} textAnchor="end" className="tick">
          {bar >= 1 ? bar.toFixed(0) : bar} {unit}
        </text>
        <text x="6" y="12" className="tick">
          N ↑ · E ←
        </text>
      </svg>
      <figcaption>
        <span>{title}</span>
      </figcaption>
    </figure>
  )
}

export default function Parallax({ target, cardId, card, name, science }) {
  const [t, setT] = useState(0) // animation phase 0..1
  const [playing, setPlaying] = useState(false) // never starts on its own: press Play
  const fromCard = cardId === 'rw-aurigae' ? plxFromCard(card) : null
  const ok = target && Number.isFinite(target.parallax_mas) && Number.isFinite(target.pmra_mas_yr) && (cardId !== 'rw-aurigae' || fromCard)
  const ra = target?.ra_j2000_deg
  const dec = target?.dec_j2000_deg
  const plx = fromCard ? fromCard.plx : target?.parallax_mas

  useEffect(() => {
    if (!ok || !playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.max(0, now - last)
      last = now
      setT((v) => (v + dt / 8000) % 1) // one loop every 8 seconds, from where it was paused
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ok, playing])

  // One year of parallax only (mas), during 2026.
  const ellipse = useMemo(
    () => (ok ? Array.from({ length: 121 }, (_, i) => parallaxShift(ra, dec, plx, 2026 + i / 120)) : []),
    [ok, ra, dec, plx],
  )
  // Proper motion + parallax over three years, 2025.5 to 2028.5 (arcsec, relative to mid-2025).
  const YEARS = 3
  const combined = useMemo(() => {
    if (!ok) return []
    return Array.from({ length: 361 }, (_, i) => {
      const y = 2025.5 + (i / 360) * YEARS
      const [pe, pn] = parallaxShift(ra, dec, plx, y)
      return [(target.pmra_mas_yr * (y - 2025.5) + pe) / 1000, (target.pmdec_mas_yr * (y - 2025.5) + pn) / 1000]
    })
  }, [ok, ra, dec, plx, target])

  if (!ok) return <p className="hint">{tr('Parallax data for this object are not available yet.')}</p>

  const yearNow = 2026 + t
  const dotE = parallaxShift(ra, dec, plx, yearNow)
  const yC = 2025.5 + t * YEARS
  const [ce, cn] = parallaxShift(ra, dec, plx, yC)
  const dotC = [(target.pmra_mas_yr * (yC - 2025.5) + ce) / 1000, (target.pmdec_mas_yr * (yC - 2025.5) + cn) / 1000]
  const pmTot = Math.hypot(target.pmra_mas_yr, target.pmdec_mas_yr)

  return (
    <div className="plx">
      <p className="plx-text">
        {tr(
          'As the Earth goes around the Sun, we see {name} from slightly different places, so every year it seems to trace a small ellipse: its parallax. The closer the star, the bigger the ellipse. On top of that it drifts in a straight line: its proper motion.',
          { name },
        )}
      </p>
      <div className="tl-controls">
        <button className="btn tl-play" onClick={() => setPlaying((p) => !p)}>
          {playing ? tr('Pause') : tr('Play')}
        </button>
        <input
          type="range"
          min="0"
          max="0.999"
          step="0.001"
          value={t}
          onChange={(e) => {
            setPlaying(false)
            setT(Number(e.target.value))
          }}
          aria-label={tr('Time of the year')}
        />
      </div>
      <Plot
        pts={ellipse}
        dot={dotE}
        unit="mas"
        title={tr('Parallax only, one year: {month} 2026 · ϖ = {plx} mas', {
          month: (getLang() === 'es' ? MONTHS_ES : MONTHS)[Math.floor(t * 12)],
          plx: fmt(plx, 2),
        })}
      />
      <Plot
        pts={combined}
        dot={dotC}
        unit="″"
        title={tr('Parallax + proper motion, mid-2025 to mid-2028: {year} · {pm}″ per year', {
          year: yC.toFixed(1),
          pm: fmt(pmTot / 1000, 2),
        })}
      />
      {EXTRA[cardId] && <p className="note">{tr(EXTRA[cardId])}</p>}
      {fromCard && (
        <p className="note">
          {tr(
            'Parallax from the distance in the science card ({dist}, {source}): ϖ ≈ {plx} mas. Not used: the SIMBAD parallax ({simbad} mas), whose error is 24 % and which is spoiled because RW Aurigae is a double star.',
            { dist: fromCard.text, source: fromCard.source, plx: fmt(plx, 2), simbad: fmt(target.parallax_mas, 2) },
          )}
        </p>
      )}
      {science ? (
        <div className="plx-eq">
          <span className="small-label">{tr('Equations (simulation, not a SkyShift measurement)')}</span>
          <code>{tr('proper motion')}: Δα·cosδ = μα*·Δt, Δδ = μδ·Δt</code>
          <code>{tr('parallax')}: Δα·cosδ = ϖ (X sinα − Y cosα)</code>
          <code>Δδ = ϖ (X cosα sinδ + Y sinα sinδ − Z cosδ)</code>
          <span className="small-label">
            {tr('X, Y, Z: Earth’s position around the Sun in AU (low-precision solar formula, Astronomical Almanac). Values:')} μα* ={' '}
            {fmt(target.pmra_mas_yr, 3)} mas/yr, μδ = {fmt(target.pmdec_mas_yr, 3)} mas/yr, ϖ = {fmt(plx, 3)} mas{fromCard ? tr(' (from the card distance)') : ''}, α ={' '}
            {fmt(ra, 4)}°, δ = {fmt(dec, 4)}° ({target.source}).
          </span>
        </div>
      ) : (
        <p className="small-label">
          {tr('Simulation from catalogue values ({source}); the equations are in Science mode.', { source: target.source })}
        </p>
      )}
    </div>
  )
}
