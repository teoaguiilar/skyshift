/*
 * SkyShift — coordinate readout for Science mode (what Aladin's own location box showed, and more).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Shows where the mouse points (or the centre of the view): RA/Dec in ICRS, in sexagesimal and in
 * degrees, galactic coordinates, and the field of view. "Grid" turns on Aladin's coordinate grid.
 */
import { t } from './i18n.js'
import { useEffect, useState } from 'react'
import { toGalactic } from './coords.js'

const pad = (n, w) => String(n).padStart(w, '0')
function hms(ra) {
  let s = Math.round(((ra / 15) * 3600) * 10) / 10 // tenths of a second of time
  s = ((s % 86400) + 86400) % 86400
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = (s % 60).toFixed(1)
  return `${pad(h, 2)}h ${pad(m, 2)}m ${sec.padStart(4, '0')}s`
}
function dms(dec) {
  const sign = dec < 0 ? '−' : '+'
  const s = Math.round(Math.abs(dec) * 3600)
  return `${sign}${pad(Math.floor(s / 3600), 2)}° ${pad(Math.floor((s % 3600) / 60), 2)}′ ${pad(s % 60, 2)}″`
}
const sdeg = (v, n) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(n)}°`
function fovText(fov) {
  const big = Math.max(fov[0], fov[1]) // same unit for both sides
  const f = (v) =>
    big >= 1 ? `${v.toFixed(2)}°` : big >= 1 / 60 ? `${(v * 60).toFixed(1)}′` : big >= 1 / 3600 ? `${(v * 3600).toFixed(0)}″` : `${(v * 3.6e6).toFixed(0)} mas`
  return `${f(fov[0])} × ${f(fov[1])}`
}

// `hub` is filled in by App: hub.cursor(d) on mouse move, hub.view() when the view changes.
export default function CooBar({ aladinRef, hub }) {
  const [cursor, setCursor] = useState(null) // {ra, dec} under the mouse, or null
  const [, setTick] = useState(0) // re-render when the view moves
  const [grid, setGrid] = useState(false)

  useEffect(() => {
    let frame = 0
    hub.cursor = (d) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setCursor(d && Number.isFinite(d.ra) ? { ra: d.ra, dec: d.dec } : null))
    }
    hub.view = () => setTick((t) => t + 1)
    return () => {
      hub.cursor = () => {}
      hub.view = () => {}
      cancelAnimationFrame(frame)
      aladinRef.current?.hideCooGrid() // leaving Science mode: no grid in Explore
    }
  }, [hub, aladinRef])

  const aladin = aladinRef.current
  if (!aladin) return null
  const [cra, cdec] = aladin.getRaDec()
  const p = cursor ?? { ra: cra, dec: cdec }
  const [l, b] = toGalactic(p.ra, p.dec)

  return (
    <div className="coo-bar" onMouseEnter={() => setCursor(null)}>
      <span className="coo-where">{cursor ? t('Mouse') : t('Centre')}</span>
      <span>
        <span className="muted">ICRS</span> RA {hms(p.ra)} · Dec {dms(p.dec)}
      </span>
      <span className="muted">
        ({p.ra.toFixed(4)}°, {sdeg(p.dec, 4)})
      </span>
      <span>
        <span className="muted">{t('Galactic')}</span> l {l.toFixed(3)}° · b {sdeg(b, 3)}
      </span>
      <span>
        <span className="muted">FoV</span> {fovText(aladin.getFov())}
      </span>
      <label className="coo-grid">
        <input
          type="checkbox"
          checked={grid}
          onChange={(e) => {
            setGrid(e.target.checked)
            if (e.target.checked) aladin.setCooGrid({ enabled: true, color: 'rgb(138,145,156)', opacity: 0.6, showLabels: true, labelSize: 11 })
            else aladin.hideCooGrid()
          }}
        />
        {t('Grid')}
      </label>
    </div>
  )
}
