// SkyShift logo, brand v2 ("Espacial"): SKYSHIFT in Michroma, the I is a ray with a cyan star.
// Drawn in code (no AI image generator). Drafted with help from Claude (Anthropic); reviewed by the SkyShift Murcia team.
// Same props as the old Logo: size = height in px of the old mark; animated = play the intro (about 2.5 s, skipped for reduced motion).
import { useEffect, useRef } from 'react'

const STAR = '#7fd8ff'
const INK = '#eef2ff'

export function Star({ cx = 50, cy = 50, r = 48, color = STAR }) {
  const w = r * 0.07,
    d = r * 0.42,
    wd = r * 0.045
  return (
    <g className="logo-star">
      <polygon points={`${cx},${cy - r} ${cx + w},${cy} ${cx},${cy + r} ${cx - w},${cy}`} fill={color} />
      <polygon points={`${cx - r},${cy} ${cx},${cy - w} ${cx + r},${cy} ${cx},${cy + w}`} fill={color} />
      <polygon points={`${cx - d},${cy - d} ${cx + wd},${cy - wd} ${cx + d},${cy + d} ${cx - wd},${cy + wd}`} fill={color} opacity=".7" />
      <polygon points={`${cx + d},${cy - d} ${cx + wd},${cy + wd} ${cx - d},${cy + d} ${cx - wd},${cy - wd}`} fill={color} opacity=".7" />
      <circle cx={cx} cy={cy} r={r * 0.13} fill={color} />
    </g>
  )
}

// Small star used as a bullet for status lines and the active tour object.
export function StarIcon({ size = 11, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ flex: 'none' }}>
      <Star color={color} />
    </svg>
  )
}

export function Logo({ size = 56, animated = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!animated || !ref.current) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current,
      E = 'cubic-bezier(.2,.7,.2,1)'
    const ray = el.querySelector('.logo-ray'),
      star = el.querySelector('.logo-star')
    ;[ray, star].forEach((n) => {
      n.style.transformBox = 'fill-box'
    })
    ray.style.transformOrigin = 'top'
    star.style.transformOrigin = 'center'
    const a = [
      el.animate([{ letterSpacing: '.6em', opacity: 0 }, { letterSpacing: '.24em', opacity: 1 }], { duration: 1600, delay: 200, easing: E, fill: 'both' }),
      ray.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 600, delay: 900, easing: E, fill: 'both' }),
      star.animate(
        [
          { transform: 'scale(0) rotate(-45deg)', opacity: 0 },
          { transform: 'scale(1.35) rotate(8deg)', opacity: 1, offset: 0.65 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 900, delay: 1350, easing: E, fill: 'both' },
      ),
    ]
    return () => a.forEach((x) => x.cancel())
  }, [animated])

  return (
    <span
      ref={ref}
      className="logo"
      role="img"
      aria-label="SkyShift"
      style={{
        fontFamily: "'Michroma', sans-serif",
        fontSize: Math.round(size * 0.5),
        letterSpacing: '.24em',
        color: INK,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      <span aria-hidden="true">SKYSH</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 40 100"
        style={{ display: 'inline-block', width: '.4em', height: '1em', verticalAlign: '-.16em', marginRight: '.24em', overflow: 'visible' }}
      >
        <polygon className="logo-ray" points="20,0 21.4,50 20,100 18.6,50" fill={INK} />
        <Star cx={20} cy={46} r={38} />
      </svg>
      <span aria-hidden="true">FT</span>
    </span>
  )
}

export default Logo
