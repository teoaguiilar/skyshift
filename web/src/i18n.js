/*
 * SkyShift — interface language (English by default, Spanish as an option).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * The key of each text is its English version, so English needs no table. {name} marks a value filled in.
 * Science cards and data notes written by the team (science/cards, data/) stay in English.
 */
let lang = (() => {
  const p = new URLSearchParams(window.location.search).get('lang')
  if (p === 'es' || p === 'en') return p
  try {
    const saved = window.localStorage.getItem('skyshift-lang')
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    /* storage not available */
  }
  return 'en'
})()

export const getLang = () => lang
export function setLang(next) {
  lang = next === 'es' ? 'es' : 'en'
  try {
    window.localStorage.setItem('skyshift-lang', lang)
  } catch {
    /* storage not available */
  }
  document.documentElement.lang = lang
  const p = new URLSearchParams(window.location.search)
  if (lang === 'es') p.set('lang', 'es')
  else p.delete('lang')
  const q = p.toString()
  window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname)
}
document.documentElement.lang = lang

export function t(text, vars) {
  let out = lang === 'es' ? (ES[text] ?? text) : text
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

const ES = {
  // Top bar, tour, map
  'See the sky move': 'Mira cómo se mueve el cielo',
  Explore: 'Explorar',
  Science: 'Ciencia',
  'Name or coordinates, e.g. 17 57 48 +04 41 36': 'Nombre o coordenadas, p. ej. 17 57 48 +04 41 36',
  'Search the sky': 'Buscar en el cielo',
  Go: 'Ir',
  'Show the tutorial': 'Ver el tutorial',
  Tutorial: 'Tutorial',
  'Guided tour': 'Visita guiada',
  moves: 'se mueve',
  'changes brightness': 'cambia de brillo',
  'Searching “{text}”…': 'Buscando «{text}»…',
  '“{text}” not found. Try another name, or coordinates such as 269.45 4.69, 17 57 48 +04 41 36 or gal 31.0 14.1.':
    'No se ha encontrado «{text}». Prueba otro nombre o unas coordenadas como 269.45 4.69, 17 57 48 +04 41 36 o gal 31.0 14.1.',
  'Gaia DR3 stars (ESA)': 'Estrellas de Gaia DR3 (ESA)',
  'zoom in to load': 'acerca el mapa para cargarlas',
  'loading…': 'cargando…',
  '{count} stars, G < 16': '{count} estrellas, G < 16',
  'Gaia archive not answering, try later': 'el archivo de Gaia no responde, prueba más tarde',
  'colour BP−RP:': 'color BP−RP:',
  'hotter → cooler · click a star': 'más caliente → más fría · pulsa una estrella',
  'Sky: NASA SPHEREx (all-sky map)': 'Cielo: NASA SPHEREx (mapa de todo el cielo)',
  'Sky: NASA WISE · zoom in to see SPHEREx': 'Cielo: NASA WISE · acerca el mapa para ver SPHEREx',
  '▼ Time-lapse below': '▼ Animación abajo',
  'Selected spot': 'Punto elegido',
  'Drag and zoom the map, then click any point of the sky — or pick a guided tour.':
    'Arrastra y acerca el mapa y pulsa cualquier punto del cielo, o elige un objeto de la visita guiada.',
  'Data: NASA SPHEREx (IRSA) · NASA WISE (ESA HiPS mirror) · ESA Gaia DR3 (optional layer, positions moved to 2026.0 with their proper motion) · object names: CDS Sesame. Sky map: Aladin Lite (CDS). Team SkyShift Murcia · NASA Space Apps Challenge 2026.':
    'Datos: NASA SPHEREx (IRSA) · NASA WISE (copia HiPS de la ESA) · ESA Gaia DR3 (capa opcional, posiciones llevadas a 2026.0 con su movimiento propio) · nombres de objetos: CDS Sesame. Mapa del cielo: Aladin Lite (CDS). Equipo SkyShift Murcia · NASA Space Apps Challenge 2026.',
  'Scientific texts and notes from the team are in English.': 'Los textos científicos y las notas del equipo están en inglés.',
  'Catalogue position in 2000: the star has moved since': 'Posición de catálogo en 2000: la estrella se ha movido desde entonces',
  // Simulation label
  Year: 'Año',
  'Close-up, 2 years (view {view} wide): {name} drifts with its proper motion and wobbles once a year by its parallax (±{wobble} mas), because we watch it from the moving Earth.':
    'De cerca, 2 años (vista de {view} de ancho): {name} avanza con su movimiento propio y se balancea una vez al año por su paralaje (±{wobble} mas), porque la miramos desde la Tierra, que se mueve.',
  '{years} years (view {view} wide): {name} moves {moved}; the yearly wobble is now far too small to see.':
    '{years} años (vista de {view} de ancho): {name} se mueve {moved}; el balanceo anual ya es demasiado pequeño para verse.',
  'Simulation from catalogue values (SIMBAD); other stars are shown where they are today.':
    'Simulación con valores de catálogo (SIMBAD); las demás estrellas salen donde están hoy.',
  'Close the simulation': 'Cerrar la simulación',
  // Time-lapse player
  'SPHEREx time-lapse': 'Animación de SPHEREx',
  ', stacked visits': ', visitas sumadas',
  'First visit': 'Primera visita',
  'Latest visit': 'Última visita',
  'Real NASA SPHEREx images. North is up; each square is one {px}″ pixel.':
    'Imágenes reales de NASA SPHEREx. El norte está arriba; cada cuadrado es un píxel de {px}″.',
  ' The cyan marks show where SkyShift measured the object.': ' Las marcas cian indican dónde midió SkyShift el objeto.',
  Frames: 'Fotos',
  Difference: 'Diferencia',
  'False colour': 'Falso color',
  'Circles: catalogue position.': 'Círculos: posición de catálogo.',
  'One visit: {from} → {to}.': 'Una visita: {from} → {to}.',
  red: 'rojo',
  green: 'verde',
  blue: 'azul',
  images: 'imágenes',
  Pause: 'Pausa',
  Play: 'Reproducir',
  'Pause the time-lapse': 'Pausar la animación',
  'Play the time-lapse': 'Reproducir la animación',
  'Observation date': 'Fecha de observación',
  Date: 'Fecha',
  Stack: 'Suma',
  detected: 'detectado',
  'not detected': 'no detectado',
  Quality: 'Calidad',
  'Quality OK': 'Calidad OK',
  Flagged: 'Con avisos',
  Saturated: 'Saturada',
  ' (no bad-pixel flags)': ' (sin avisos de píxeles malos)',
  '· details in Science mode': '· detalles en el modo Ciencia',
  'Show catalogue position': 'Ver la posición de catálogo',
  '▶ Watch it move: 2 years up close, then {years} years': '▶ Ver cómo se mueve: 2 años de cerca y luego {years} años',
  '· simulation': '· simulación',
  Motion: 'Movimiento',
  Brightness: 'Brillo',
  Spectrum: 'Espectro',
  Parallax: 'Paralaje',
  'Up close': 'De cerca',
  About: 'Ficha',
  '{n} images · {first} → {last} · 1 square = 1 SPHEREx pixel ({px}″)': '{n} imágenes · {first} → {last} · 1 cuadrado = 1 píxel de SPHEREx ({px}″)',
  'Report a candidate ↗': 'Informar de un candidato ↗',
  'SPHEREx time-lapse for this object is coming soon.': 'La animación de SPHEREx de este objeto llegará pronto.',
  'Loading SPHEREx images…': 'Cargando imágenes de SPHEREx…',
  // Click anywhere
  Detector: 'Detector',
  Field: 'Campo',
  '{band}: about {range} (infrared) · field {size}′ × {size}′': '{band}: unos {range} (infrarrojo) · campo de {size}′ × {size}′',
  ' · larger fields take a little longer': ' · los campos grandes tardan algo más',
  'Searching the SPHEREx archive at this spot… this can take about 20 seconds.':
    'Buscando en el archivo de SPHEREx en este punto… puede tardar unos 20 segundos.',
  'Downloading SPHEREx images… {done}/{total} (about half a minute)': 'Descargando imágenes de SPHEREx… {done}/{total} (cerca de medio minuto)',
  'Not enough SPHEREx images at a similar wavelength here yet. Try another spot or detector.':
    'Aún no hay suficientes imágenes de SPHEREx con una longitud de onda parecida aquí. Prueba otro punto u otro detector.',
  'The NASA SPHEREx archive (IRSA) did not answer: it is busy or down for a moment. This is not an error in your search.':
    'El archivo de NASA SPHEREx (IRSA) no ha respondido: está ocupado o caído un momento. No es un error de tu búsqueda.',
  'Try again': 'Reintentar',
  '{n} of {searched} SPHEREx images here were taken at a similar wavelength (±2 %).':
    '{n} de las {searched} imágenes de SPHEREx de aquí se tomaron con una longitud de onda parecida (±2 %).',
  'Something that shifts between dates is only a': 'Algo que se desplaza entre fechas es solo un',
  'candidate moving object': 'candidato a objeto en movimiento',
  ', and something that changes brightness only a': ', y algo que cambia de brillo es solo un',
  'candidate variable': 'candidato a variable',
  ', until it is checked against other data.': ', hasta que se compruebe con otros datos.',
  // Charts
  'Shift towards the {dir} (arcsec)': 'Desplazamiento hacia el {dir} (segundos de arco)',
  north: 'norte',
  south: 'sur',
  east: 'este',
  west: 'oeste',
  'Measured by SkyShift (SPHEREx): mean per visit ± standard error': 'Medido por SkyShift (SPHEREx): media por visita ± error típico',
  'Single SPHEREx images': 'Imágenes sueltas de SPHEREx',
  'Expected from the catalogue motion': 'Lo esperado por el movimiento de catálogo',
  'Relative brightness (SPHEREx)': 'Brillo relativo (SPHEREx)',
  'Mean per visit ± standard error': 'Media por visita ± error típico',
  'Changes much larger than the bars make it a candidate variable until checked.':
    'Los cambios mucho mayores que las barras la convierten en candidata a variable hasta que se compruebe.',
  'Spectrum: brightness at each colour (SPHEREx, 0.75–5 µm)': 'Espectro: brillo en cada color (SPHEREx, 0,75–5 µm)',
  'SPHEREx images averaged by wavelength; bar = uncertainty. Absolute values are approximate.':
    'Imágenes de SPHEREx promediadas por longitud de onda; barra = incertidumbre. Los valores absolutos son aproximados.',
  '{n} saturated images left out.': 'Se han dejado fuera {n} imágenes saturadas.',
  // Card
  'Why it matters here: ': 'Por qué importa aquí: ',
  'Source:': 'Fuente:',
  'Read the science': 'Lee la ciencia',
  'The system': 'El sistema',
  'The system, in detail': 'El sistema, en detalle',
  // Parallax tab
  'As the Earth goes around the Sun, we see {name} from slightly different places, so every year it seems to trace a small ellipse: its parallax. The closer the star, the bigger the ellipse. On top of that it drifts in a straight line: its proper motion.':
    'Como la Tierra gira alrededor del Sol, vemos {name} desde sitios un poco distintos, así que cada año parece dibujar una pequeña elipse: su paralaje. Cuanto más cerca está la estrella, más grande es la elipse. Además avanza en línea recta: su movimiento propio.',
  'Parallax only, one year: {month} 2026 · ϖ = {plx} mas': 'Solo el paralaje, un año: {month} 2026 · ϖ = {plx} mas',
  'Parallax + proper motion, mid-2025 to mid-2028: {year} · {pm}″ per year':
    'Paralaje + movimiento propio, de mediados de 2025 a mediados de 2028: {year} · {pm}″ al año',
  'Parallax from the distance in the science card ({dist}, {source}): ϖ ≈ {plx} mas. Not used: the SIMBAD parallax ({simbad} mas), whose error is 24 % and which is spoiled because RW Aurigae is a double star.':
    'Paralaje calculado con la distancia de la ficha científica ({dist}, {source}): ϖ ≈ {plx} mas. No se usa el paralaje de SIMBAD ({simbad} mas): su error es del 24 % y está estropeado porque RW Aurigae es una estrella doble.',
  'Epsilon Indi B is a pair (Ba and Bb) orbiting each other, so their combined light also wobbles with that orbit (Chen et al. 2022). That extra motion is not drawn: our data do not include the orbit.':
    'Epsilon Indi B es una pareja (Ba y Bb) que gira una alrededor de la otra, así que su luz conjunta también se balancea con esa órbita (Chen et al. 2022). Ese movimiento extra no se dibuja: nuestros datos no incluyen la órbita.',
  'proper motion': 'movimiento propio',
  parallax: 'paralaje',
  'X, Y, Z: Earth’s position around the Sun in AU (low-precision solar formula, Astronomical Almanac). Values:':
    'X, Y, Z: posición de la Tierra alrededor del Sol en UA (fórmula solar de baja precisión, Astronomical Almanac). Valores:',
  ' (from the card distance)': ' (de la distancia de la ficha)',
  'Parallax data for this object are not available yet.': 'Aún no hay datos de paralaje para este objeto.',
  'Equations (simulation, not a SkyShift measurement)': 'Ecuaciones (simulación, no es una medida de SkyShift)',
  'Simulation from catalogue values ({source}); the equations are in Science mode.':
    'Simulación con valores de catálogo ({source}); las ecuaciones están en el modo Ciencia.',
  // Up close
  "Artist's impression · drawn by code written with AI help · not to scale":
    'Recreación artística · dibujada con código escrito con ayuda de IA · sin escala',
  "Artist's impression of {name}": 'Recreación artística de {name}',
  'A single red dwarf; planets drawn only if the card lists them.': 'Una enana roja sola; los planetas se dibujan solo si la ficha los incluye.',
  'A pair of brown dwarfs (Ba and Bb) orbiting each other.': 'Una pareja de enanas marrones (Ba y Bb) que giran una alrededor de la otra.',
  'A single, very cold brown dwarf.': 'Una enana marrón sola y muy fría.',
  'A young star surrounded by a disk of gas and dust.': 'Una estrella joven rodeada de un disco de gas y polvo.',
  'A young star whose light is dimmed when clumps of dust in its disk pass in front.':
    'Una estrella joven cuya luz se apaga cuando pasan por delante grumos de polvo de su disco.',
  'A giant star that pulsates, changing size and brightness.': 'Una estrella gigante que pulsa y cambia de tamaño y de brillo.',
  'Colour: the approximate colour of a body at {temp}, the temperature in the science card{cold}.':
    'Color: el color aproximado de un cuerpo a {temp}, la temperatura de la ficha científica{cold}.',
  ' (below about 1,000 K a body hardly glows in visible light, so it is drawn very dark)':
    ' (por debajo de unos 1.000 K un cuerpo apenas brilla en luz visible, así que se dibuja muy oscuro)',
  'Colour: neutral until the science card gives a temperature.': 'Color: neutro hasta que la ficha científica dé una temperatura.',
  'Planets: {n}, as listed in the card (orbits not to scale).': 'Planetas: {n}, los que lista la ficha (órbitas sin escala).',
  // Gaia star card
  'Looking up the name in SIMBAD…': 'Buscando el nombre en SIMBAD…',
  'SIMBAD did not answer: use the link below': 'SIMBAD no ha respondido: usa el enlace de abajo',
  'No other name in SIMBAD': 'Sin otro nombre en SIMBAD',
  'Open in SIMBAD ↗': 'Abrir en SIMBAD ↗',
  Close: 'Cerrar',
  // Coordinate bar
  Mouse: 'Ratón',
  Centre: 'Centro',
  Galactic: 'Galácticas',
  Grid: 'Cuadrícula',
  // Welcome screen
  'SPHEREx is a NASA telescope that photographs the whole sky in infrared, again and again. SkyShift lines up those photos by date, so you can see what moves or changes brightness.':
    'SPHEREx es un telescopio de la NASA que fotografía todo el cielo en infrarrojo, una y otra vez. SkyShift ordena esas fotos por fecha para que veas qué se mueve o cambia de brillo.',
  'Watch nearby stars drift across the sky.': 'Mira cómo las estrellas cercanas se desplazan por el cielo.',
  'See young and old stars change brightness.': 'Mira estrellas jóvenes y viejas cambiar de brillo.',
  'Click any point of the sky to see its SPHEREx images.': 'Pulsa cualquier punto del cielo para ver sus imágenes de SPHEREx.',
  Start: 'Empezar',
  'Or open in Science mode': 'O abrir en modo Ciencia',
  'Or jump straight to one of the challenge objects (real SPHEREx images):':
    'O ve directo a uno de los objetos del reto (imágenes reales de SPHEREx):',
  'Data: NASA SPHEREx (IRSA) · ESA Gaia DR3 · Team SkyShift Murcia · NASA Space Apps Challenge 2026':
    'Datos: NASA SPHEREx (IRSA) · ESA Gaia DR3 · Equipo SkyShift Murcia · NASA Space Apps Challenge 2026',
  'Welcome to SkyShift': 'Te damos la bienvenida a SkyShift',
  // Tutorial buttons
  Skip: 'Saltar',
  Back: 'Atrás',
  Next: 'Siguiente',
  Done: 'Hecho',
}
