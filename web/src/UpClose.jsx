/*
 * SkyShift — "Up close": an animated artist's impression of each guided-tour object, drawn in code.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * No AI image generator. What is drawn comes from the science card (science/cards/<id>.json):
 *   - the colour from the card's Temperature (blackbody colour, approximate),
 *   - the number of planets from a "Planets" fact, if the card has one,
 *   - the kind of system (disk, pair, pulsating giant) from the object's type, as agreed by the team.
 * Sizes and distances are NOT to scale; the caption says so.
 */
import { useEffect, useRef } from 'react'

// How each object is drawn. `basis` says which fact of the card supports the drawing.
const RECIPES = {
  barnard: { look: 'star', basis: 'A single red dwarf; planets drawn only if the card lists them.' },
  'eps-indi-b': { look: 'pair', banded: true, basis: 'A pair of brown dwarfs (Ba and Bb) orbiting each other.' },
  'wise-0855': { look: 'star', banded: true, basis: 'A single, very cold brown dwarf.' },
  'rw-aurigae': { look: 'disk', basis: 'A young star surrounded by a disk of gas and dust.' },
  'ux-orionis': { look: 'disk', clumps: true, basis: 'A young star whose light is dimmed when clumps of dust in its disk pass in front.' },
  'r-draconis': { look: 'pulsing', basis: 'A giant star that pulsates, changing size and brightness.' },
}

// Numbers in a fact value: "about 5,040" -> [5040]; "225-250" -> [237.5] (middle of the range);
// "1,300-1,385 (Ba) and 880-1,011 (Bb)" -> [1342.5, 945.5] (one value per body of a pair).
function factNumbers(card, re) {
  const f = card?.facts?.find((x) => re.test(x.label))
  if (!f) return null
  const text = String(f.value).replace(/,/g, '')
  const parts = text.split(/\band\b|;/)
  const values = parts
    .map((p) => (p.match(/\d+(\.\d+)?/g) || []).map(Number))
    .filter((n) => n.length)
    .map((n) => (n.length >= 2 ? (n[0] + n[1]) / 2 : n[0]))
  if (!values.length) return null
  return { value: values[0], values, text: `${f.value} ${f.unit ?? ''}`.trim() }
}

// Approximate colour of a blackbody at temperature T (Kelvin), as RGB 0-255.
// Fit by Tanner Helland (2012), valid about 1,000-40,000 K. Below 1,000 K a body hardly glows
// in visible light: it is drawn very dark red.
function blackbodyRGB(T) {
  if (T < 1000) return [70, 18, 22]
  const t = T / 100
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))))
}

export const hasUpClose = (cardId) => Boolean(RECIPES[cardId])

export default function UpClose({ cardId, card, name }) {
  const canvasRef = useRef(null)
  const recipe = RECIPES[cardId]
  const temp = factNumbers(card, /temp/i)
  const planets = factNumbers(card, /planet/i)
  const nPlanets = planets ? Math.min(8, Math.round(planets.value)) : 0
  const rgb = temp ? blackbodyRGB(temp.value) : [200, 205, 220]
  const rgb2 = temp?.values?.[1] ? blackbodyRGB(temp.values[1]) : rgb // second body of a pair

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !recipe) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let tint = rgb
    const col = (a = 1, k = 1) => `rgba(${tint.map((c) => Math.round(Math.min(255, c * k))).join(',')},${a})`
    const cx = W / 2
    const cy = H / 2
    // Fixed background stars (decoration).
    const bg = Array.from({ length: 70 }, (_, i) => [((i * 97) % 997) / 997, ((i * 389) % 991) / 991, 0.3 + ((i * 13) % 7) / 10])
    const clumps = Array.from({ length: 5 }, (_, i) => ({ phase: i / 5, size: 6 + (i % 3) * 4 }))
    let raf = 0
    const t0 = performance.now()

    const body = (x, y, r, glow, banded, time) => {
      // soft halo, drawn as a few transparent rings (no gradients, as the brand asks)
      for (let k = 4; k >= 1; k--) {
        ctx.fillStyle = col(0.05 * glow, 1)
        ctx.beginPath()
        ctx.arc(x, y, r * (1 + k * 0.35), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = col(1, banded ? 0.75 : 1)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      if (banded) {
        // cloud bands that drift slowly, like on a giant planet
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.clip()
        for (let i = -3; i <= 3; i++) {
          ctx.fillStyle = i % 2 ? col(0.55, 0.45) : col(0.35, 1.1)
          const yy = y + i * r * 0.28 + Math.sin(time / 1500 + i) * r * 0.03
          ctx.fillRect(x - r, yy - r * 0.07, r * 2, r * 0.14)
        }
        ctx.restore()
      }
    }

    const frame = (now) => {
      const time = still ? 0 : now - t0
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#04070f'
      ctx.fillRect(0, 0, W, H)
      bg.forEach(([x, y, a]) => {
        ctx.fillStyle = `rgba(238,242,255,${a * (still ? 1 : 0.7 + 0.3 * Math.sin(time / 900 + x * 50))})`
        ctx.fillRect(x * W, y * H, 1.2, 1.2)
      })

      if (recipe.look === 'pair') {
        const a = time / 4000
        const d = Math.min(W, H) * 0.24
        tint = rgb
        body(cx + Math.cos(a) * d * 0.8, cy + Math.sin(a) * d * 0.55 * 0.8, 26, 0.6, true, time)
        tint = rgb2
        body(cx - Math.cos(a) * d * 1.2, cy - Math.sin(a) * d * 0.55 * 1.2, 21, 0.5, true, time)
        tint = rgb
      } else if (recipe.look === 'disk') {
        const r = 22
        const tilt = recipe.clumps ? 0.16 : 0.32 // UX Ori: disk seen almost edge-on
        const ring = (behind) => {
          for (let k = 0; k < 18; k++) {
            ctx.strokeStyle = `rgba(214,170,120,${0.05 + 0.02 * (k % 3)})`
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.ellipse(cx, cy, r * 1.6 + k * 5, (r * 1.6 + k * 5) * tilt, 0, behind ? Math.PI : 0, behind ? Math.PI * 2 : Math.PI)
            ctx.stroke()
          }
        }
        ring(true)
        // dimming: when a dust clump crosses the star, the star gets fainter
        let dim = 1
        const pos = clumps.map((c) => {
          const ang = (c.phase + time / 9000) * Math.PI * 2
          const x = cx + Math.cos(ang) * (r * 2.4)
          const front = Math.sin(ang) > 0
          if (recipe.clumps && front && Math.abs(x - cx) < r) dim = Math.min(dim, 0.45)
          return { x, y: cy + Math.sin(ang) * r * 2.4 * tilt, front, size: c.size }
        })
        ctx.globalAlpha = dim
        body(cx, cy, r, 0.8, false, time)
        ctx.globalAlpha = 1
        ring(false)
        if (recipe.clumps)
          pos.filter((p) => p.front).forEach((p) => {
            ctx.fillStyle = 'rgba(120,85,60,0.85)'
            ctx.beginPath()
            ctx.ellipse(p.x, p.y, p.size, p.size * 0.7, 0, 0, Math.PI * 2)
            ctx.fill()
          })
      } else if (recipe.look === 'pulsing') {
        const s = 1 + 0.12 * Math.sin(time / 1300)
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time / 1300)
        body(cx, cy, 48 * s, 1, false, time)
        ctx.globalAlpha = 1
      } else {
        body(cx, cy, recipe.banded ? 32 : 30, recipe.banded ? 0.3 : 0.9, recipe.banded, time)
      }

      // planets, only if the card says how many
      for (let i = 0; i < nPlanets && recipe.look === 'star'; i++) {
        const R = 50 + i * 22
        const ang = time / (2500 + i * 1800) + i * 1.7
        ctx.strokeStyle = 'rgba(154,163,194,0.25)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(cx, cy, R, R * 0.3, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#c9d2ea'
        ctx.beginPath()
        ctx.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R * 0.3, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!still) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [recipe, rgb.join(','), rgb2.join(','), nPlanets]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!recipe) return null
  return (
    <figure className="upclose">
      <canvas ref={canvasRef} className="upclose-canvas" role="img" aria-label={`Artist's impression of ${name}`} />
      <span className="upclose-tag">Artist's impression · drawn by code written with AI help · not to scale</span>
      <figcaption className="small-label">
        {recipe.basis}{' '}
        {temp
          ? `Colour: the approximate colour of a body at ${temp.text}, the temperature in the science card${Math.min(...temp.values) < 1000 ? ' (below about 1,000 K a body hardly glows in visible light, so it is drawn very dark)' : ''}.`
          : 'Colour: neutral until the science card gives a temperature.'}
        {nPlanets > 0 ? ` Planets: ${nPlanets}, as listed in the card (orbits not to scale).` : ''}
      </figcaption>
    </figure>
  )
}
