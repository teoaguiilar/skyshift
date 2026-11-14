/*
 * SkyShift — welcome screen shown before the sky map.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * The map loads behind this screen, so it is ready when the user presses Start.
 */
import { useEffect, useState } from 'react'
import { Logo, StarIcon } from './Logo.jsx'

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
        <Logo size={44} animated />
        <h1 className="title-xl intro-title">See the sky move</h1>

        <p className="intro-lead">
          SPHEREx is a NASA telescope that photographs the whole sky in infrared, again and again. SkyShift lines up those
          photos by date, so you can see what moves or changes brightness.
        </p>

        <ul className="intro-list">
          <li>
            <StarIcon size={12} color="var(--accent)" />
            Watch nearby stars drift across the sky.
          </li>
          <li>
            <StarIcon size={12} color="var(--accent)" />
            See young and old stars change brightness.
          </li>
          <li>
            <StarIcon size={12} color="var(--accent)" />
            Click any point of the sky to see its SPHEREx images.
          </li>
        </ul>

        <button className="btn btn-primary intro-start" onClick={() => start('explore')} autoFocus>
          Start
        </button>
        <button className="btn btn-link intro-science" onClick={() => start('science')}>
          Or open in Science mode: charts, spectrum, quality flags, Gaia DR3
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
