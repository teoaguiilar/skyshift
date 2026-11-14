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
  "NASA's IRSA archive is not answering right now. Try again in a few minutes, or explore the guided tour.":
    'El archivo IRSA de la NASA no responde ahora mismo. Inténtalo de nuevo en unos minutos o explora la visita guiada.',
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
  // Report form
  'Report a candidate': 'Informar de un candidato',
  'Describe what you see (at least one sentence).': 'Describe lo que ves (al menos una frase).',
  'Say which images or catalogues show it.': 'Di qué imágenes o catálogos lo muestran.',
  'Fact {n}: write both the name and the value.': 'Dato {n}: escribe el nombre y el valor.',
  'Fact {n}: every number needs a source and a working link.': 'Dato {n}: cada cifra necesita una fuente y un enlace que funcione.',
  'Paper {n}: write its title and a working link.': 'Artículo {n}: escribe su título y un enlace que funcione.',
  'Please remove emails and phone numbers: no personal data.': 'Quita correos y teléfonos: nada de datos personales.',
  'Your proposal uses the same format as the SkyShift science cards. It is sent as a public GitHub issue (a GitHub account is needed) and appears on the SkyShift map only after the team reviews and approves it.':
    'Tu propuesta usa el mismo formato que las fichas científicas de SkyShift. Se envía como un aviso público en GitHub (hace falta una cuenta de GitHub) y solo aparece en el mapa de SkyShift cuando el equipo la revisa y la aprueba.',
  'What do you see?': '¿Qué ves?',
  'Something that moves between dates': 'Algo que se mueve entre fechas',
  'Something that changes brightness': 'Algo que cambia de brillo',
  'Something else': 'Otra cosa',
  'Name (optional; a catalogue name if it has one)': 'Nombre (opcional; el de catálogo si lo tiene)',
  'Description: 2-3 simple sentences': 'Descripción: 2 o 3 frases sencillas',
  'Why it is interesting (optional)': 'Por qué es interesante (opcional)',
  'Evidence: which images or catalogues show it? Did you check Gaia DR3 or SIMBAD?':
    'Pruebas: ¿qué imágenes o catálogos lo muestran? ¿Lo has comprobado en Gaia DR3 o SIMBAD?',
  'Facts (optional): every number needs a source': 'Datos (opcional): cada cifra necesita su fuente',
  'Name, e.g. Distance': 'Nombre, p. ej. Distancia',
  Value: 'Valor',
  Unit: 'Unidad',
  'Source, e.g. Gaia DR3': 'Fuente, p. ej. Gaia DR3',
  Remove: 'Quitar',
  'Add a fact': 'Añadir un dato',
  'Papers (optional)': 'Artículos (opcional)',
  Title: 'Título',
  'First author et al. (year)': 'Primer autor et al. (año)',
  'Add a paper': 'Añadir un artículo',
  'See the JSON': 'Ver el JSON',
  Copied: 'Copiado',
  'Copy JSON': 'Copiar JSON',
  'Send for review on GitHub ↗': 'Enviar a revisión en GitHub ↗',
  'No personal data, please. A candidate is not a discovery until it is checked.':
    'Sin datos personales, por favor. Un candidato no es un descubrimiento hasta que se comprueba.',
  'Community candidate': 'Candidato de la comunidad',
  'Community candidates (approved by the team)': 'Candidatos de la comunidad (aprobados por el equipo)',
  'Spectrum (on the fly)': 'Espectro (al momento)',
  Visit: 'Visita',
  'Measuring every SPHEREx image of this visit, all six detectors… up to 1 min.':
    'Midiendo cada imagen de SPHEREx de esta visita, en los seis detectores… hasta 1 min.',
  'IRSA took too long, try again': 'IRSA ha tardado demasiado, inténtalo otra vez',
  'SPHEREx has no images of this point yet.': 'SPHEREx aún no tiene imágenes de este punto.',
  'Visit {from} → {to} · {n} measurements · {skipped} images skipped · {s} s': 'Visita {from} → {to} · {n} medidas · {skipped} imágenes descartadas · {s} s',
  'partial: IRSA was slow, so not every image was measured.': 'parcial: IRSA iba lento, así que no se midieron todas las imágenes.',
  'Measured on the fly: no aperture correction, so absolute values are approximate; the shape is what matters.':
    'Medido al momento: sin corrección de apertura, así que los valores absolutos son aproximados; lo que importa es la forma.',
  // Intuitive layer
  Moves: 'Se mueve',
  'Changes brightness': 'Cambia de brillo',
  'What to look for': 'Qué mirar',
  'It moves {pm}″ a year towards the {dir} (catalogue value). Watch the dot shift between the first and the latest visit.':
    'Se mueve {pm}″ al año hacia el {dir} (valor de catálogo). Mira cómo se desplaza el punto entre la primera y la última visita.',
  'north-east': 'noreste',
  'south-east': 'sureste',
  'south-west': 'suroeste',
  'north-west': 'noroeste',
  'It is too bright for SPHEREx: it saturates the images, so its brightness changes cannot be measured here.':
    'Es demasiado brillante para SPHEREx: satura las imágenes, así que aquí no se pueden medir sus cambios de brillo.',
  'Between visits its SPHEREx brightness changed by about ×{ratio}. Watch it get brighter and fainter.':
    'Entre visitas, su brillo en SPHEREx cambió unas ×{ratio} veces. Mira cómo se enciende y se apaga.',
  'Watch it move': 'Ver cómo se mueve',
  'Share link': 'Compartir enlace',
  'Link copied': 'Enlace copiado',
  'Copy this link': 'Copia este enlace',
  'Start here': 'Empieza aquí',
  'The star with the largest proper motion across our sky.': 'La estrella con el mayor movimiento propio de nuestro cielo.',
  'A very cold brown dwarf, made visible by stacking SPHEREx images.': 'Una enana marrón muy fría, que se ve sumando imágenes de SPHEREx.',
  'A young star whose light is dimmed by clumps of dust.': 'Una estrella joven cuya luz apagan grumos de polvo.',
  'Or drag and zoom the map and click any point of the sky to see its SPHEREx images.':
    'O arrastra y acerca el mapa y pulsa cualquier punto del cielo para ver sus imágenes de SPHEREx.',
  'Sky date': 'Fecha del cielo',
  'Previous image': 'Imagen anterior',
  'Next image': 'Imagen siguiente',
  '{n} SPHEREx images · {from} → {to}': '{n} imágenes de SPHEREx · {from} → {to}',
  'Pick an object or a spot to jump between SPHEREx images': 'Elige un objeto o un punto para saltar entre imágenes de SPHEREx',
  'The background map combines all SPHEREx images, so it does not change. The date picks the SPHEREx image of the time-lapse, moves the Gaia stars and shows where the star is on that date.':
    'El mapa de fondo combina todas las imágenes de SPHEREx, así que no cambia. La fecha elige la imagen de SPHEREx de la animación, mueve las estrellas de Gaia y muestra dónde está la estrella en esa fecha.',
  'Position on {date}': 'Posición el {date}',
  'Flagged · more than half of the images had flags': 'Con avisos · más de la mitad de las imágenes tenían avisos',
  'Quality OK · {k} of {n} images had flags ({flags}); the median of the visit is barely affected':
    'Calidad OK · {k} de {n} imágenes tenían avisos ({flags}); la mediana de la visita apenas cambia',
  'Quality OK · none of the {n} images had bad-pixel flags': 'Calidad OK · ninguna de las {n} imágenes tenía avisos de píxeles malos',
  'grey = single images (outside the range: cut off)': 'gris = imágenes sueltas (las que se salen del rango, cortadas)',
  'Spectrum, filtered: only {a}–{b} µm (SPHEREx)': 'Espectro filtrado: solo {a}–{b} µm (SPHEREx)',
  'Spectrum view': 'Vista del espectro',
  'All wavelengths': 'Todas las longitudes de onda',
  'Filtering: {a}–{b} µm': 'Filtrado: {a}–{b} µm',
  'Detectors {d} · {k} images kept, {l} left out.': 'Detectores {d} · {k} imágenes usadas, {l} descartadas.',
  'Median brightness': 'Brillo mediano',
  'The sky images are hidden: this view is smaller than one pixel of the map.':
    'Las imágenes del cielo se ocultan: esta vista es más pequeña que un píxel del mapa.',
  // Tutorial buttons
  Skip: 'Saltar',
  Back: 'Atrás',
  Next: 'Siguiente',
  Done: 'Hecho',
}
