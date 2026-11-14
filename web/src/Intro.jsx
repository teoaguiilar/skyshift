/*
 * SkyShift — welcome screen (brand v2, logo animation "D · Espacial", palette "Noche y hielo").
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Starfield drawn in code (canvas), logo in SVG code: no AI image generator. The thumbnails are real
 * NASA SPHEREx images from our pipeline. On "Start" the stars stream past (warp) and the map appears.
 */
import { useEffect, useRef, useState } from 'react'
import { Star, StarIcon } from './Logo.jsx'
import { t } from './i18n.js'

const INK = '#eef2ff'
const ICE = '#7fd8ff'
const EASE = 'cubic-bezier(.2,.7,.2,1)'
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Starfield: points in 3D flying slowly towards the viewer; `warp` speeds them up into streaks.
function useStarfield(canvasRef, warpRef) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const N = 420
    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const stars = Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random(),
      tw: Math.random() * Math.PI * 2, // twinkle phase
      ice: Math.random() < 0.12, // a few cyan stars, the brand accent
    }))
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const still = reduceMotion()
    let last = performance.now()
    const born = last
    const draw = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const warp = warpRef.current // 0 = idle, grows to ~1 while leaving
      const speed = still ? 0 : 0.035 + warp * 2.6
      const fadeIn = Math.min((now - born) / 1400, 1)
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const scale = Math.max(w, h) * 0.6
      for (const s of stars) {
        const zPrev = s.z
        s.z -= speed * dt
        if (s.z <= 0.02) {
          s.x = (Math.random() - 0.5) * 2
          s.y = (Math.random() - 0.5) * 2
          s.z = 1
          continue
        }
        const px = cx + (s.x / s.z) * scale
        const py = cy + (s.y / s.z) * scale
        if (px < -50 || px > w + 50 || py < -50 || py > h + 50) continue
        const near = 1 - s.z
        const twinkle = still ? 1 : 0.65 + 0.35 * Math.sin(now / 700 + s.tw)
        const alpha = Math.min(1, (0.15 + near * 0.9) * twinkle) * fadeIn
        ctx.strokeStyle = ctx.fillStyle = s.ice ? ICE : INK
        ctx.globalAlpha = alpha
        if (warp > 0.02) {
          // streak from the previous depth to the current one
          const qx = cx + (s.x / zPrev) * scale
          const qy = cy + (s.y / zPrev) * scale
          ctx.lineWidth = 0.6 + near * 1.6
          ctx.beginPath()
          ctx.moveTo(qx, qy)
          ctx.lineTo(px, py)
          ctx.stroke()
        } else {
          const r = 0.35 + near * 1.3
          ctx.beginPath()
          ctx.arc(px, py, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef, warpRef])
}

// The big logo, animated letter by letter like the brand animation "D · Espacial".
function BigLogo() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reduceMotion()) return
    const anims = []
    const A = (node, kf, o) => node && anims.push(node.animate(kf, { fill: 'both', easing: EASE, ...o }))
    // The logo is born in the middle of the screen, bigger, and rises to its place when the text arrives.
    const box = el.getBoundingClientRect()
    const dy = window.innerHeight / 2 - (box.top + box.height / 2)
    A(
      el,
      [
        { transform: `translateY(${dy}px) scale(1.3)` },
        { transform: `translateY(${dy}px) scale(1.3)`, offset: 0.7, easing: 'cubic-bezier(.6,0,.2,1)' },
        { transform: 'none' },
      ],
      { duration: 3000, easing: 'linear' },
    )
    const word = el.querySelector('.big-word')
    A(word, [{ letterSpacing: '.6em', opacity: 0 }, { letterSpacing: '.24em', opacity: 1 }], { duration: 1600, delay: 300 })
    el.querySelectorAll('.big-word > .ch').forEach((c, i) =>
      A(c, [{ opacity: 0, transform: 'translateY(.25em)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], {
        duration: 700,
        delay: 400 + i * 55,
      }),
    )
    const ray = el.querySelector('.logo-ray')
    ray.style.transformBox = 'fill-box'
    ray.style.transformOrigin = 'top'
    A(ray, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 600, delay: 1000 })
    const star = el.querySelector('.logo-star')
    star.style.transformBox = 'fill-box'
    star.style.transformOrigin = 'center'
    A(
      star,
      [
        { transform: 'scale(0) rotate(-45deg)', opacity: 0 },
        { transform: 'scale(1.35) rotate(8deg)', opacity: 1, offset: 0.65 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 900, delay: 1450 },
    )
    // When the star flares: two thin rings of light spread out from it.
    el.querySelectorAll('.flare-ring').forEach((ring, i) => {
      ring.style.transformBox = 'fill-box'
      ring.style.transformOrigin = 'center'
      A(ring, [{ transform: 'scale(0)', opacity: 0.9 }, { transform: 'scale(26)', opacity: 0 }], {
        duration: 1500,
        delay: 1750 + i * 220,
        easing: 'cubic-bezier(.1,.6,.3,1)',
      })
    })
    // Then the star keeps breathing softly.
    anims.push(
      star.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], {
        duration: 2600,
        delay: 2600,
        iterations: Infinity,
        easing: 'ease-in-out',
      }),
    )
    return () => anims.forEach((a) => a.cancel())
  }, [])

  return (
    <div ref={ref} className="big-logo" role="img" aria-label="SkyShift">
      <div className="big-word" aria-hidden="true">
        {[...'SKYSH'].map((c, i) => (
          <span className="ch" key={i}>
            {c}
          </span>
        ))}
        <svg className="big-i" viewBox="0 0 40 100">
          <circle className="flare-ring" cx="20" cy="46" r="10" fill="none" stroke={ICE} strokeWidth="1.2" vectorEffect="non-scaling-stroke" opacity="0" />
          <circle className="flare-ring" cx="20" cy="46" r="10" fill="none" stroke={ICE} strokeWidth="0.7" vectorEffect="non-scaling-stroke" opacity="0" />
          <polygon className="logo-ray" points="20,0 21.4,50 20,100 18.6,50" fill={INK} />
          <Star cx={20} cy={46} r={38} />
        </svg>
        {[...'FT'].map((c, i) => (
          <span className="ch" key={i}>
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Intro({ tour = [], onLeave, onStart, lang = 'en', onLang }) {
  const [leaving, setLeaving] = useState(false)
  const canvasRef = useRef(null)
  const warpRef = useRef(0)
  const rootRef = useRef(null)
  useStarfield(canvasRef, warpRef)

  const start = (mode, objectId = null) => {
    if (leaving) return
    setLeaving(true)
    onLeave?.(mode)
    if (reduceMotion()) return onStart(mode, objectId)
    // Warp: the stars accelerate into streaks for a moment, then everything fades into the map.
    const t0 = performance.now()
    const ramp = (now) => {
      const f = Math.min((now - t0) / 1100, 1)
      warpRef.current = f * f
      if (f < 1) requestAnimationFrame(ramp)
    }
    requestAnimationFrame(ramp)
    setTimeout(() => onStart(mode, objectId), 1300)
  }

  // Enter starts in Explore mode, as the main button does.
  useEffect(() => {
    const onKey = (e) => e.key === 'Enter' && start('explore')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div ref={rootRef} className={`intro${leaving ? ' leaving' : ''}`} role="dialog" aria-modal="true" aria-label={t('Welcome to SkyShift')}>
      {onLang && (
        <div className="seg lang-switch intro-lang" role="tablist" aria-label="Language / Idioma">
          {['en', 'es'].map((l) => (
            <button key={l} className={lang === l ? 'on' : ''} onClick={() => onLang(l)} role="tab" aria-selected={lang === l}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <canvas ref={canvasRef} className="intro-sky" aria-hidden="true" />
      <div className="intro-card">
        <BigLogo />
        <p className="intro-tag reveal" style={{ '--d': '2.3s' }}>
          {t('See the sky move')}
        </p>

        <p className="intro-lead reveal" style={{ '--d': '2.6s' }}>
          {t(
            'SPHEREx is a NASA telescope that photographs the whole sky in infrared, again and again. SkyShift lines up those photos by date, so you can see what moves or changes brightness.',
          )}
        </p>

        <ul className="intro-list reveal" style={{ '--d': '2.85s' }}>
          <li>
            <StarIcon size={12} color="var(--accent)" />
            {t('Watch nearby stars drift across the sky.')}
          </li>
          <li>
            <StarIcon size={12} color="var(--accent)" />
            {t('See young and old stars change brightness.')}
          </li>
          <li>
            <StarIcon size={12} color="var(--accent)" />
            {t('Click any point of the sky to see its SPHEREx images.')}
          </li>
        </ul>

        <div className="intro-actions reveal" style={{ '--d': '3.1s' }}>
          <button className="btn btn-primary intro-start" onClick={() => start('explore')} autoFocus>
            {t('Start')}
          </button>
          <button className="btn btn-link intro-science" onClick={() => start('science')}>
            {t('Or open in Science mode')}
          </button>
        </div>

        {tour.length > 0 && (
          <div className="intro-objects reveal" style={{ '--d': '3.4s' }}>
            <span className="small-label">{t('Or jump straight to one of the challenge objects (real SPHEREx images):')}</span>
            <div className="intro-thumbs">
              {tour.map((t) => (
                <button key={t.id} className="intro-thumb" onClick={() => start('explore', t.id)}>
                  <img src={t.thumb} alt="" loading="eager" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="intro-foot reveal" style={{ '--d': '3.6s' }}>
          {t('Data: NASA SPHEREx (IRSA) · ESA Gaia DR3 · Team SkyShift Murcia · NASA Space Apps Challenge 2026')}
        </p>
      </div>
    </div>
  )
}
