/*
 * SkyShift — short guided tutorial of the page (spotlight + one card per step).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Each step points at an element by CSS selector; steps whose element is not on screen are skipped.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

// Steps for everybody (Explore mode).
export const EXPLORE_STEPS = [
  {
    target: '.search',
    title: 'Search the sky',
    text: 'Type the name of a star (for example “Barnard’s Star”) or its coordinates, then press Go. Coordinates can be in degrees (269.45 4.69), in hours and degrees (17 57 48 +04 41 36) or galactic (gal 31.0 14.1).',
  },
  {
    target: '.tour',
    title: 'Guided tour',
    text: 'The objects of the challenge. Solid border: the star moves. Dashed border: the star changes brightness. Press one and the map flies there.',
  },
  {
    target: '.map-wrap',
    title: 'The infrared sky',
    text: 'Drag to move, scroll or pinch to zoom. Zoom in and the map switches to SPHEREx. Click any point to see the SPHEREx images of that spot.',
  },
  {
    target: '.panel',
    title: 'Time-lapse',
    text: 'Here the same small patch of sky plays date by date. For a spot you clicked, choose the SPHEREx detector (D1 to D6, shorter to longer infrared) and the size of the field. “Difference” shows the last visit minus the first one. In the guided tour, “Watch it move” plays on the map where the star will go in the next 100 to 10,000 years (a simulation from its catalogue motion). Seen something odd? “Report a candidate” opens a public report.',
  },
  {
    target: '.mode-switch',
    title: 'Two modes',
    text: 'Explore shows the essentials. Science adds the measurements: motion and brightness charts, the spectrum, quality flags and Gaia DR3 stars.',
  },
  {
    target: '.help-btn',
    title: 'Need this again?',
    text: 'Press ? at any time to see this tutorial again.',
  },
]

// Extra steps shown the first time someone opens Science mode.
export const SCIENCE_STEPS = [
  {
    target: '.gaia-toggle',
    title: 'Gaia DR3 stars (ESA)',
    text: 'Draws Gaia DR3 stars brighter than G = 16 on the map, moved from 2016 to 2026 with their own motion. Zoom in below 1° to load them. Each circle is coloured by the star’s measured colour (BP−RP): bluer stars are hotter, redder ones cooler (dust also makes stars look redder). Click a star to see its Gaia DR3 name, its other name in SIMBAD if it has one, and its measurements.',
  },
  {
    target: '.coo-bar',
    title: 'Coordinates',
    text: 'Where the mouse points (or the centre of the view, if the mouse is off the map): right ascension and declination in the ICRS frame, in hours and degrees, the same point in galactic coordinates (l, b), and FoV, the size of the view. “Grid” draws the coordinate grid on the sky.',
  },
  {
    target: '.panel',
    title: 'Measurements',
    text: 'Under the time-lapse: Motion and Brightness charts (one point per visit, with its error bar; single images in grey), the spectrum, and the wavelength and quality flags of every image. Every number comes from the SPHEREx files.',
  },
  {
    target: '.mode-switch',
    title: 'Back to Explore',
    text: 'Switch back to Explore at any time for a simpler view.',
  },
]

const PAD = 8 // px of space around the highlighted element

export default function Tutorial({ steps, onClose }) {
  const visible = steps.filter((s) => document.querySelector(s.target))
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = visible[i]

  const measure = useCallback(() => {
    const el = step && document.querySelector(step.target)
    if (!el) return setRect(null)
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [step])

  // Bring the element into view (phones scroll), then measure it.
  useLayoutEffect(() => {
    const el = step && document.querySelector(step.target)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    measure()
    const t = setTimeout(measure, 450)
    return () => clearTimeout(t)
  }, [step, measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [measure])

  const next = () => (i < visible.length - 1 ? setI(i + 1) : onClose())
  const back = () => setI(Math.max(0, i - 1))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!step) return null

  // Card under the element if there is room, otherwise above it. Phones: fixed at the bottom (CSS).
  const vh = window.innerHeight
  const vw = window.innerWidth
  const cardW = Math.min(340, vw - 24)
  let cardStyle = {}
  if (rect) {
    const below = rect.top + rect.height + 12
    const left = Math.min(Math.max(12, rect.left), vw - cardW - 12)
    cardStyle =
      below + 190 < vh
        ? { top: below, left, width: cardW }
        : rect.top - 12 > 190
          ? { top: rect.top - 12, left, width: cardW, transform: 'translateY(-100%)' }
          : { top: Math.max(12, vh / 2 - 95), left: Math.max(12, vw / 2 - cardW / 2), width: cardW }
  }

  return (
    <div className="tut" role="dialog" aria-modal="true" aria-label="Tutorial">
      {rect && <div className="tut-spot" style={rect} />}
      <div className="tut-card" style={cardStyle} key={i}>
        <span className="tut-count">
          {i + 1} / {visible.length}
        </span>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tut-actions">
          <button className="tut-skip" onClick={onClose}>
            Skip
          </button>
          {i > 0 && (
            <button className="tut-back" onClick={back}>
              Back
            </button>
          )}
          <button className="tut-next" onClick={next} autoFocus>
            {i < visible.length - 1 ? 'Next' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
