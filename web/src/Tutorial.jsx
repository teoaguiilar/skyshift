/*
 * SkyShift — short guided tutorial of the page (spotlight + one card per step).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Each step points at an element by CSS selector; steps whose element is not on screen are skipped.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { getLang, t } from './i18n.js'

// Steps for everybody (Explore mode).
export const EXPLORE_STEPS = [
  {
    target: '.search',
    title: 'Search the sky',
    titleEs: 'Buscar en el cielo',
    textEs: 'Escribe el nombre de una estrella (por ejemplo «Barnard’s Star») o sus coordenadas y pulsa Ir. Las coordenadas pueden ir en grados (269.45 4.69), en horas y grados (17 57 48 +04 41 36) o galácticas (gal 31.0 14.1).',
    text: 'Type the name of a star (for example “Barnard’s Star”) or its coordinates, then press Go. Coordinates can be in degrees (269.45 4.69), in hours and degrees (17 57 48 +04 41 36) or galactic (gal 31.0 14.1).',
  },
  {
    target: '.tour',
    title: 'Guided tour',
    titleEs: 'Visita guiada',
    textEs: 'Los objetos del reto, con miniaturas reales de SPHEREx. La etiqueta bajo cada nombre dice si se mueve o cambia de brillo. Pulsa uno y el mapa vuela hasta él.',
    text: 'The objects of the challenge, with real SPHEREx thumbnails. The label under each name says whether it moves or changes brightness. Press one and the map flies there.',
  },
  {
    target: '.map-wrap',
    title: 'The infrared sky',
    titleEs: 'El cielo en infrarrojo',
    textEs: 'Arrastra para moverte; usa la rueda o pellizca para acercar. Al acercarte, el mapa pasa a SPHEREx. Pulsa cualquier punto para ver las imágenes de SPHEREx de ese sitio.',
    text: 'Drag to move, scroll or pinch to zoom. Zoom in and the map switches to SPHEREx. Click any point to see the SPHEREx images of that spot.',
  },
  {
    target: '.panel',
    title: 'Time-lapse',
    titleEs: 'Animación',
    textEs: 'Aquí se ve el mismo trocito de cielo fecha a fecha. En un punto que hayas pulsado, elige el detector de SPHEREx (de D1 a D6, del infrarrojo más corto al más largo) y el tamaño del campo. «Diferencia» enseña la última visita menos la primera. En la visita guiada, «Ver cómo se mueve» lo enseña en el mapa: primero 2 años de cerca (el balanceo anual del paralaje) y luego adónde irá la estrella en los próximos 100 a 10.000 años (una simulación con sus valores de catálogo), y «De cerca» muestra una recreación artística del objeto hecha a partir de su ficha científica. ¿Has visto algo raro? «Informar de un candidato» abre un aviso público.',
    text: 'Here the same small patch of sky plays date by date. For a spot you clicked, choose the SPHEREx detector (D1 to D6, shorter to longer infrared) and the size of the field. “Difference” shows the last visit minus the first one. In the guided tour, “Watch it move” plays on the map, first 2 years up close (the yearly parallax wobble) and then where the star will go in the next 100 to 10,000 years (a simulation from its catalogue values), and “Up close” shows an artist’s impression of the object, drawn from its science card. Seen something odd? “Report a candidate” opens a public report.',
  },
  {
    target: '.mode-switch',
    title: 'Two modes',
    titleEs: 'Dos modos',
    textEs: 'Explorar enseña lo esencial. Ciencia añade las medidas: gráficos de movimiento y de brillo, el espectro, los avisos de calidad y las estrellas de Gaia DR3.',
    text: 'Explore shows the essentials. Science adds the measurements: motion and brightness charts, the spectrum, quality flags and Gaia DR3 stars.',
  },
  {
    target: '.help-btn',
    title: 'Need this again?',
    titleEs: '¿Lo necesitas otra vez?',
    textEs: 'Pulsa ? cuando quieras para volver a ver este tutorial.',
    text: 'Press ? at any time to see this tutorial again.',
  },
]

// Extra steps shown the first time someone opens Science mode.
export const SCIENCE_STEPS = [
  {
    target: '.gaia-toggle',
    title: 'Gaia DR3 stars (ESA)',
    titleEs: 'Estrellas de Gaia DR3 (ESA)',
    textEs: 'Dibuja en el mapa las estrellas de Gaia DR3 más brillantes que G = 16, llevadas de 2016 a 2026 con su propio movimiento. Acerca el mapa por debajo de 1° para cargarlas. Cada círculo lleva el color medido de la estrella (BP−RP): las más azules son más calientes y las más rojas, más frías (el polvo también enrojece las estrellas). Pulsa una estrella para ver su nombre en Gaia DR3, su otro nombre en SIMBAD si lo tiene, y sus medidas.',
    text: 'Draws Gaia DR3 stars brighter than G = 16 on the map, moved from 2016 to 2026 with their own motion. Zoom in below 1° to load them. Each circle is coloured by the star’s measured colour (BP−RP): bluer stars are hotter, redder ones cooler (dust also makes stars look redder). Click a star to see its Gaia DR3 name, its other name in SIMBAD if it has one, and its measurements.',
  },
  {
    target: '.coo-bar',
    title: 'Coordinates',
    titleEs: 'Coordenadas',
    textEs: 'Dónde apunta el ratón (o el centro de la vista, si el ratón está fuera del mapa): ascensión recta y declinación en el sistema ICRS, en horas y en grados, el mismo punto en coordenadas galácticas (l, b) y FoV, el tamaño de la vista. «Cuadrícula» dibuja la cuadrícula de coordenadas en el cielo.',
    text: 'Where the mouse points (or the centre of the view, if the mouse is off the map): right ascension and declination in the ICRS frame, in hours and degrees, the same point in galactic coordinates (l, b), and FoV, the size of the view. “Grid” draws the coordinate grid on the sky.',
  },
  {
    target: '.panel',
    title: 'Measurements',
    titleEs: 'Medidas',
    textEs: 'Debajo de la animación: gráficos de movimiento y de brillo (un punto por visita con su barra de error; las imágenes sueltas en gris), el espectro, y la longitud de onda y los avisos de calidad de cada imagen. Todas las cifras salen de los archivos de SPHEREx.',
    text: 'Under the time-lapse: Motion and Brightness charts (one point per visit, with its error bar; single images in grey), the spectrum, and the wavelength and quality flags of every image. Every number comes from the SPHEREx files.',
  },
  {
    target: '.mode-switch',
    title: 'Back to Explore',
    titleEs: 'Volver a Explorar',
    textEs: 'Vuelve a Explorar cuando quieras para una vista más sencilla.',
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
  const es = getLang() === 'es'

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

  // Phones: the card goes to the top when the element it explains is in the lower half, so it never covers it.
  const phoneTop = !!rect && rect.top + rect.height / 2 > vh / 2

  return (
    <div className="tut" role="dialog" aria-modal="true" aria-label="Tutorial">
      {rect && <div className="tut-spot" style={rect} />}
      <div className={`tut-card${phoneTop ? ' tut-top' : ''}`} style={cardStyle} key={i}>
        <span className="tut-count">
          {i + 1} / {visible.length}
        </span>
        <h3>{es ? step.titleEs ?? step.title : step.title}</h3>
        <p>{es ? step.textEs ?? step.text : step.text}</p>
        <div className="tut-actions">
          <button className="tut-skip" onClick={onClose}>
            {t('Skip')}
          </button>
          {i > 0 && (
            <button className="tut-back" onClick={back}>
              {t('Back')}
            </button>
          )}
          <button className="tut-next" onClick={next} autoFocus>
            {i < visible.length - 1 ? t('Next') : t('Done')}
          </button>
        </div>
      </div>
    </div>
  )
}
