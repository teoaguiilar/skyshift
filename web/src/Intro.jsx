/*
 * SkyShift — welcome screen shown before the sky map.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * The map loads behind this screen, so it is ready when the user presses Start.
 */
import { useEffect, useState } from 'react'

// Brand mark: a blue dot (first visit) that shifts to a red dot (last visit).
export function Logo({ size = 56, animated = false }) {
  return (
    <svg className={`logo${animated ? ' animated' : ''}`} viewBox="0 0 230 56" height={size} role="img" aria-label="SkyShift">
      <circle cx="14" cy="34" r="6" fill="#4aa3ff" />
      <line x1="21" y1="30" x2="35" y2="22" stroke="#8a919c" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="42" cy="18" r="6" fill="#ff4a4a" />
      {animated && <circle className="logo-travel" cx="14" cy="34" r="3" fill="#e6e8eb" />}
      <text x="60" y="38" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="30" fontWeight="700" letterSpacing="0.5">
        <tspan fill="#e6e8eb">Sky</tspan>
        <tspan fill="#ff7a3d">Shift</tspan>
      </text>
    </svg>
  )
}

export default function Intro({ onLeave, onStart }) {
  const [leaving, setLeaving] = useState(false)

  const start = (mode) => {
    if (leaving) return
    setLeaving(true)
    onLeave?.(mode) // the map starts its zoom while the screen fades
    setTimeout(() => onStart(mode), 900) // matches the CSS exit animation
  }

  // Enter starts in Explore mode, as the main button does.
  useEffect(() => {
    const onKey = (e) => e.key === 'Enter' && start('explore')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={`intro${leaving ? ' leaving' : ''}`} role="dialog" aria-modal="true" aria-label="Welcome to SkyShift">
      <div className="intro-card">
        <Logo size={64} animated />
        <p className="intro-tag">See the sky move.</p>

        <p className="intro-lead">
          SPHEREx is a NASA telescope that photographs the whole sky in infrared, again and again. SkyShift lines up those
          photos by date, so you can see what moves or changes brightness.
        </p>

        <ul className="intro-list">
          <li>
            <span className="intro-ico moves" aria-hidden="true" />
            Watch nearby stars drift across the sky.
          </li>
          <li>
            <span className="intro-ico varies" aria-hidden="true" />
            See young and old stars change brightness.
          </li>
          <li>
            <span className="intro-ico click" aria-hidden="true" />
            Click any point of the sky to see its SPHEREx images.
          </li>
        </ul>

        <button className="intro-start" onClick={() => start('explore')} autoFocus>
          Start
        </button>
        <button className="intro-science" onClick={() => start('science')}>
          or open in Science mode (charts, spectrum, quality flags, Gaia DR3)
        </button>

        <p className="intro-foot">
          Data: NASA SPHEREx (IRSA) · ESA Gaia DR3
          <br />
          Team SkyShift Murcia · NASA Space Apps Challenge 2026
        </p>
      </div>
    </div>
  )
}
