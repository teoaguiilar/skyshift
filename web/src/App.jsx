/*
 * SkyShift — sky map (Minimum level).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
 * See AI_USAGE.md. Sky map: Aladin Lite (CDS, LGPL-3.0) — see SOURCES.md.
 */
import { useEffect, useRef, useState } from 'react'
import A from 'aladin-lite'
import TimeLapse from './TimeLapse.jsx'
import SpotLapse from './SpotLapse.jsx'
import Intro from './Intro.jsx'
import { Logo } from './Logo.jsx'
import Tutorial, { EXPLORE_STEPS, SCIENCE_STEPS } from './Tutorial.jsx'
import CooBar from './CooBar.jsx'
import { parallaxShift } from './Parallax.jsx'
import { parseCoords } from './coords.js'
import { getLang, setLang, t, t as tr } from './i18n.js'
import GaiaStar, { GAIA_BINS, GAIA_NO_COLOUR, binFor } from './GaiaStar.jsx'
import ObjectCard from './ObjectCard.jsx'
import { DISCUSSIONS, DiscussButton } from './Discuss.jsx'
import DateControl, { mjdToDate, mjdToYear } from './DateControl.jsx'
import './App.css'

// The five test objects of the challenge, resolved by name through CDS Sesame.
const TOUR = [
// `id` = folder name in data/ (agreed with the data pipeline).
  {
    id: 'barnard',
    label: "Barnard's Star",
    query: "Barnard's star",
    kind: 'moves',
    spectrumNote: 'Only 3.8–5 µm is shown: at shorter wavelengths the star saturates SPHEREx.',
  },
  { id: 'eps-indi-b', label: 'Epsilon Indi B', query: 'eps Ind B', kind: 'moves' },
  {
    id: 'wise-0855-stacked',
    card: 'wise-0855',
    label: 'WISE 0855−0714',
    query: 'WISE J085510.83-071442.5',
    kind: 'moves',
    note: 'Too faint in single images: SkyShift stacks all SPHEREx images of each visit to reveal it.',
    // Main image in false colour: the red brown dwarf next to the blue background star (idea of Benjamín).
    startFalseColor: true,
    thumb: 'false_color.png',
  },
  { id: 'rw-aurigae', label: 'RW Aurigae', query: 'RW Aur', kind: 'varies' },
  {
    id: 'r-draconis',
    label: 'R Draconis',
    query: 'R Dra',
    kind: 'varies',
    hideSpectrum: true, // saturated in 2,318 of 2,325 images
    note: 'R Draconis is so bright that it saturates SPHEREx in every image, so its brightness changes cannot be measured with this method.',
  },
  { id: 'ux-orionis', label: 'UX Orionis', query: 'UX Ori', kind: 'varies' },
]

// Other names people may type for the tour objects (compared without spaces, dots, quotes or dashes).
const TOUR_ALIASES = {
  barnard: ['barnard', 'barnards', 'barnardsstar', 'estrelladebarnard', 'gj699', 'gl699', 'v2500oph'],
  'eps-indi-b': ['epsindb', 'epsilonindib', 'epsindib', 'epsilonindusb'],
  'wise-0855-stacked': ['wise0855', 'wise08550714', 'wisej0855', 'wisej085510.83071442.5', 'wisej085510830714425', 'wise0855714'],
  'rw-aurigae': ['rwaur', 'rwaurigae'],
  'r-draconis': ['rdra', 'rdraconis'],
  'ux-orionis': ['uxori', 'uxorionis'],
}
const normName = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
function tourObjectFor(text) {
  const n = normName(text)
  if (!n) return null
  return (
    TOUR.find((t) => normName(t.label) === n || normName(t.query) === n || normName(t.id) === n) ??
    TOUR.find((t) => (TOUR_ALIASES[t.id] ?? []).some((a) => normName(a) === n))
  )
}

const DEFAULT_FOV = 0.5 // degrees
// Label of the circle at the year-2000 catalogue position (shorter on phones, where it must fit the map).
const catalogueLabel = () =>
  window.matchMedia('(max-width: 760px)').matches
    ? t('Catalogue position (2000)')
    : t('Catalogue position in 2000: the object has moved since')

// Coordinates typed in the search box that fall on a guided-tour object open its full panel, as its name
// does. Fast-moving stars are matched anywhere along their path from the year-2000 catalogue position to
// today's position (Barnard's Star has moved about 4.5′ since 2000). Positions: target of each manifest.
const TOUR_MATCH_ARCMIN = 1
let tourTargets = null
const loadTourTargets = () =>
  (tourTargets ??= Promise.all(
    TOUR.map((o) =>
      fetch(`${REPO_DATA}/${o.id}/manifest.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => (m?.target ? { id: o.id, ...m.target } : null))
        .catch(() => null),
    ),
  ).then((list) => list.filter(Boolean)))
function tourObjectAt(ra, dec, targets) {
  const year = new Date().getFullYear() + new Date().getMonth() / 12
  let best = null
  for (const tg of targets) {
    const cosd = Math.cos((tg.dec_j2000_deg * Math.PI) / 180)
    // Offsets in arcmin on the sky, from the year-2000 position.
    const x = (((ra - tg.ra_j2000_deg + 540) % 360) - 180) * cosd * 60
    const y = (dec - tg.dec_j2000_deg) * 60
    const dt = year - 2000
    const px = (((tg.pmra_mas_yr ?? 0) * dt) / 3.6e6) * 60
    const py = (((tg.pmdec_mas_yr ?? 0) * dt) / 3.6e6) * 60
    const len2 = px * px + py * py
    const k = len2 > 0 ? Math.max(0, Math.min(1, (x * px + y * py) / len2)) : 0
    const d = Math.hypot(x - k * px, y - k * py)
    if (d <= TOUR_MATCH_ARCMIN && (!best || d < best.d)) best = { id: tg.id, ra: tg.ra_j2000_deg, dec: tg.dec_j2000_deg, d }
  }
  return best
}
// "Start here" suggestions in the empty panel (one line each, checked by the science team).
const START_HERE = [
  { id: 'barnard', text: 'The star with the largest proper motion across our sky.' },
  { id: 'wise-0855-stacked', text: 'A very cold brown dwarf, made visible by stacking SPHEREx images.' },
  { id: 'ux-orionis', text: 'A young star whose light is dimmed by clumps of dust.' },
]
// Thumbnails for the guided tour: the first real SPHEREx image of each object (from the pipeline, on GitHub).
const REPO_DATA = 'https://raw.githubusercontent.com/teoaguiilar/skyshift/main/data'
const thumbOf = (t) => `${REPO_DATA}/${t.id}/${t.thumb ?? (t.id.endsWith('-stacked') ? 'visit_01.png' : 'frame_001.png')}`
// Load the guided-tour thumbnails as soon as the page opens (during the welcome screen), so they are
// ready, not empty boxes, when the map appears.
for (const o of TOUR) new Image().src = thumbOf(o)

// Fast base map for smooth navigation: AllWISE colour infrared sky (NASA WISE data),
// served from ESA's HiPS mirror, which answers about 4x faster than IRSA from Europe.
const BASE_SURVEY = 'https://skies.esac.esa.int/AllWISEColor'
// SPHEREx DR1 all-sky data cube (HiPS) from NASA/IPAC IRSA, laid on top when zoomed in.
const SPHEREX_SURVEY = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube'
// The cube has one image per wavelength. Temporary choice; the data team picks the final one.
const SPHEREX_SLICE = 30
const SPHEREX_MAX_FOV = 15 // degrees: SPHEREx layer appears below this field of view

// Gaia DR3 stars (ESA), through our /api/gaia function. Off by default.
const GAIA_MAX_FOV = 1 // degrees: only load stars when zoomed in
const GAIA_EPOCH = 2016.0
// Gaia positions are moved to the "sky date" chosen in the date control (2026.0 until one is chosen).
const skyEpoch = { year: 2026.0 }
function moveToEpoch([ra, dec, pmra, pmdec]) {
  if (pmra == null || pmdec == null) return [ra, dec]
  const dt = skyEpoch.year - GAIA_EPOCH
  const ddec = (pmdec * dt) / 3.6e6
  const dra = (pmra * dt) / 3.6e6 / Math.cos((dec * Math.PI) / 180)
  return [ra + dra, dec + ddec]
}

// Name -> coordinates with the CDS Sesame resolver (SIMBAD, NED, VizieR).
async function resolveName(name) {
  const r = await fetch(`https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?${encodeURIComponent(name)}`)
  const xml = await r.text()
  const ra = parseFloat((xml.match(/<jradeg>([^<]+)/) || [])[1])
  const dec = parseFloat((xml.match(/<jdedeg>([^<]+)/) || [])[1])
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) throw new Error('not found')
  return { ra, dec }
}

function readUrl() {
  const p = new URLSearchParams(window.location.search)
  const ra = parseFloat(p.get('ra'))
  const dec = parseFloat(p.get('dec'))
  const fov = parseFloat(p.get('fov'))
  if (Number.isFinite(ra) && Number.isFinite(dec)) {
    return { ra, dec, fov: Number.isFinite(fov) ? fov : DEFAULT_FOV }
  }
  return null
}

// Two modes: 'explore' (everybody) and 'science' (adds the measurements). Kept in the URL.
function readMode() {
  return new URLSearchParams(window.location.search).get('mode') === 'science' ? 'science' : 'explore'
}
function writeMode(mode) {
  const p = new URLSearchParams(window.location.search)
  if (mode === 'science') p.set('mode', 'science')
  else p.delete('mode')
  const q = p.toString()
  window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname)
}
// A shared link or QR code (object or position) skips the welcome screen.
const hasDeepLink = () => {
  const p = new URLSearchParams(window.location.search)
  return p.has('object') || p.has('ra')
}

// Full tutorial for each mode (Science adds its own steps before "Two modes").
const tutorialFor = (mode) =>
  mode === 'science' ? [...EXPLORE_STEPS.slice(0, 4), ...SCIENCE_STEPS.slice(0, 3), ...EXPLORE_STEPS.slice(4)] : EXPLORE_STEPS

function writeUrl(ra, dec, fov, objectId) {
  const p = new URLSearchParams()
  const old = new URLSearchParams(window.location.search)
  if (readMode() === 'science') p.set('mode', 'science')
  if (objectId) p.set('object', objectId)
  // Detector and field size chosen for "click anywhere" (set by SpotLapse) stay in the link.
  ;['band', 'size'].forEach((k) => old.has(k) && p.set(k, old.get(k)))
  p.set('ra', ra.toFixed(5))
  p.set('dec', dec.toFixed(5))
  p.set('fov', fov.toFixed(3))
  window.history.replaceState(null, '', `?${p.toString()}`)
}

export default function App() {
  const mapRef = useRef(null)
  const interactedRef = useRef(false) // set once the user moves the map or picks something
  const objectClickRef = useRef(0) // time of the last click on a catalogue object (Gaia star, candidate)
  const aladinRef = useRef(null)
  const markerLayerRef = useRef(null)
  const [selected, setSelected] = useState(readUrl())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [skyLayer, setSkyLayer] = useState('base')
  const [gaiaOn, setGaiaOn] = useState(false)
  const [mode, setModeState] = useState(readMode)
  const [lang, setLangState] = useState(getLang) // re-renders everything when the language changes
  const changeLang = (next) => {
    setLang(next)
    setLangState(next)
  }
  const science = mode === 'science'
  const [showIntro, setShowIntro] = useState(() => !hasDeepLink())
  const [tutorial, setTutorial] = useState(null) // list of steps while the tutorial is open
  const scienceTutSeen = useRef(false)
  const cooHub = useRef({ cursor: () => {}, view: () => {} }).current // feeds the Science coordinate bar
  const [gaiaStatus, setGaiaStatus] = useState(null) // {key, vars}, translated when shown
  const [gaiaStar, setGaiaStar] = useState(null) // Gaia star clicked on the map
  const [candidate, setCandidate] = useState(null) // community candidate (approved by the team) clicked on the map
  // Sky date: the time-lapse reports its image (player); the date control asks for one (requestMjd) or,
  // with nothing selected, sets a free date (freeMjd). Gaia stars and the moving star follow it.
  const [player, setPlayer] = useState(null)
  const [requestMjd, setRequestMjd] = useState(null)
  const [freeMjd, setFreeMjd] = useState(null)
  const dateMarkerRef = useRef(null)
  const gaiaRef = useRef({ on: false, refresh: () => {} })
  const panelRef = useRef(null)
  const [scrolledDown, setScrolledDown] = useState(false)
  const isPhone = () => window.matchMedia('(max-width: 760px)').matches
  const showPanel = () => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useEffect(() => {
    // Phones: the "Time-lapse below" button only while the panel is still out of sight under the screen.
    const onScroll = () => {
      const top = panelRef.current?.getBoundingClientRect().top
      setScrolledDown(window.scrollY > 200 || (top != null && top < window.innerHeight - 80))
    }
    onScroll()
    const timer = setInterval(onScroll, 1000) // the panel moves when the map or the panel change size
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      clearInterval(timer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  const [activeId, setActiveId] = useState(() => new URLSearchParams(window.location.search).get('object'))

  // Select a sky position: marker + URL + panel.
  // ---- "Watch it move": the star's path over years, from its catalogue proper motion (simulation).
  const simRef = useRef({ marker: null, trail: null, raf: 0 })
  const [simLabel, setSimLabel] = useState(null)
  const [simPaused, setSimPaused] = useState(false)
  const toggleSimPause = () => {
    simRef.current.paused = !simRef.current.paused
    setSimPaused(simRef.current.paused)
  }
  // During the 2-year close-up the view is far smaller than one map pixel, so the sky images would only
  // show big grey blocks: hide them (black sky) and show them again afterwards.
  function setSkyHidden(hidden) {
    const sim = simRef.current
    sim.dark = hidden
    // Black instead of the empty map's grey (most visible on phones).
    document.querySelector('.map')?.classList.toggle('sky-hidden', hidden)
    try {
      sim.base?.setOpacity(hidden ? 0 : 1)
      sim.spherex?.setOpacity(hidden ? 0 : 1)
    } catch {
      /* layer not ready yet */
    }
  }
  function clearSim() {
    const sim = simRef.current
    cancelAnimationFrame(sim.raf)
    clearTimeout(sim.raf)
    setSkyHidden(false)
    sim.paused = false
    sim.pausedAt = null
    setSimPaused(false)
    sim.marker?.removeAll()
    sim.trail?.removeAll()
    setSimLabel(null)
  }
  // target = manifest.target from the pipeline: J2000 position and proper motion from SIMBAD (via Sesame).
  // plx = parallax used by the team (mas). Position at a decimal year = J2000 position + proper motion
  // + the yearly parallax wobble (same equations as the Parallax tab).
  // Two phases: (1) close-up, 2 years, where the parallax wobble is visible; (2) zoom out, many years.
  function simulate(target, years, plx) {
    const aladin = aladinRef.current
    const sim = simRef.current
    if (!aladin || !sim.marker) return
    clearSim()
    interactedRef.current = true
    const name = TOUR.find((t) => t.id === activeId)?.label ?? 'The star'
    const cosd = Math.cos((target.dec_j2000_deg * Math.PI) / 180)
    const p = Number.isFinite(plx) ? plx : 0
    const at = (year) => {
      const t = year - 2000
      const [pe, pn] = parallaxShift(target.ra_j2000_deg, target.dec_j2000_deg, p, year) // mas
      const dec = target.dec_j2000_deg + (target.pmdec_mas_yr * t + pn) / 3.6e6
      const ra = target.ra_j2000_deg + (target.pmra_mas_yr * t + pe) / 3.6e6 / cosd
      return [ra, dec]
    }
    const start = 2026
    const pm = Math.hypot(target.pmra_mas_yr, target.pmdec_mas_yr) // mas/yr
    const fmtAngle = (arcsec) => (arcsec >= 60 ? `${(arcsec / 60).toFixed(1)}′` : arcsec >= 1 ? `${arcsec.toFixed(1)}″` : `${(arcsec * 1000).toFixed(0)} mas`)

    // A run of the marker along at(year) from y0 to y1, centred on the path, then `next`.
    const phase = (y0, y1, duration, dots, label, next) => {
      const pts = Array.from({ length: 50 }, (_, i) => at(y0 + ((y1 - y0) * i) / 49))
      const ras = pts.map((q) => q[0])
      const decs = pts.map((q) => q[1])
      const cra = (Math.max(...ras) + Math.min(...ras)) / 2
      const cdec = (Math.max(...decs) + Math.min(...decs)) / 2
      const extent = Math.max((Math.max(...ras) - Math.min(...ras)) * cosd, Math.max(...decs) - Math.min(...decs)) // deg
      const fov = Math.max(extent * 2.2, 0.1 / 3600) // Aladin cannot zoom below about 0.1″
      const run = () => {
        sim.trail.removeAll()
        let t0 = performance.now()
        let lastDot = -1
        const frame = (now) => {
          // Paused: keep the clock still (the start time moves forward with the pause).
          if (sim.paused) {
            sim.pausedAt ??= now
            sim.raf = requestAnimationFrame(frame)
            return
          }
          if (sim.pausedAt != null) {
            t0 += now - sim.pausedAt
            sim.pausedAt = null
          }
          const f = Math.min(Math.max(0, now - t0) / duration, 1)
          const year = y0 + (y1 - y0) * f
          const [ra, dec] = at(year)
          sim.marker.removeAll()
          sim.marker.addSources([A.source(ra, dec)])
          const dot = Math.floor(f * dots)
          if (dot !== lastDot) {
            lastDot = dot
            sim.trail.addSources([A.source(ra, dec)])
          }
          setSimLabel({ ...label, name, year, view: fmtAngle(fov * 3600) })
          if (f < 1) sim.raf = requestAnimationFrame(frame)
          else if (next) {
            const go = () => (sim.paused ? (sim.raf = setTimeout(go, 300)) : next())
            sim.raf = setTimeout(go, 1500)
          }
        }
        sim.raf = requestAnimationFrame(frame)
      }
      const close = label.phase === 'close'
      aladin.animateToRaDec(cra, cdec, 1.2, () => {
        if (close) setSkyHidden(true) // hide before diving below the map's resolution
        aladin.zoomToFoV(fov, 1.2, () => {
          if (!close) setSkyHidden(false) // show the sky again once zoomed back out
          run()
        })
      })
    }

    const longRun = () =>
      phase(start, start + years, 7000, 24, { phase: 'long', years, moved: (pm * years) / 1000, wobble: p })
    phase(start, start + 2, 8000, 90, { phase: 'close', years: 2, moved: (pm * 2) / 1000, wobble: p }, longRun)
  }

  function selectSpot(ra, dec, fovOverride, objectId = null) {
    const aladin = aladinRef.current
    if (!aladin) return
    clearSim()
    setCandidate(null)
    setGaiaStar(null) // a Gaia card belongs to the previous view
    const fov = fovOverride ?? aladin.getFov()[0]
    markerLayerRef.current.removeAll()
    // Tour objects that move: the name resolver gives the catalogue position for the year 2000, and the
    // star is no longer there (Barnard's Star is about 4.5′ further north today). Say so next to the circle.
    const moves = TOUR.find((t) => t.id === objectId)?.kind === 'moves'
    markerLayerRef.current.addSources([A.source(ra, dec, { label: moves ? catalogueLabel() : '' })])
    writeUrl(ra, dec, fov, objectId)
    setSelected({ ra, dec, fov })
    setActiveId(objectId)
  }

  function setMode(next, { tutorial: withTutorial = true } = {}) {
    setModeState(next)
    writeMode(next)
    if (next === 'explore') setGaiaStar(null)
    if (next === 'explore' && gaiaRef.current.on) {
      // Gaia is a Science layer: switch it off in Explore.
      setGaiaOn(false)
      gaiaRef.current.on = false
      gaiaRef.current.refresh()
    }
    // First visit to Science: show its extra steps (after the new elements are on screen).
    if (next === 'science' && withTutorial && !scienceTutSeen.current) {
      scienceTutSeen.current = true
      setTimeout(() => setTutorial(SCIENCE_STEPS), 80)
    }
  }

  // Welcome screen: while it fades, the map dives in a little.
  function onIntroLeave() {
    const aladin = aladinRef.current
    if (aladin && !interactedRef.current) aladin.zoomToFoV(40, 2.2)
  }
  function onIntroStart(startMode, objectId = null) {
    setShowIntro(false)
    if (startMode === 'science') scienceTutSeen.current = true
    setMode(startMode, { tutorial: false })
    const picked = TOUR.find((t) => t.id === objectId)
    if (picked) goTo(picked.query, picked.id) // straight to that object; the ? button opens the tutorial
    else setTimeout(() => setTutorial(tutorialFor(startMode)), 250)
  }

  useEffect(() => {
    let cancelled = false
    A.init.then(() => {
      if (cancelled || aladinRef.current) return
      const start = readUrl()
      const base = A.imageHiPS(BASE_SURVEY, { name: 'AllWISE colour (NASA WISE)' })
      const aladin = A.aladin(mapRef.current, {
        survey: base, // fast infrared base map
        fov: start ? start.fov : 100, // start wide, like a planetarium
        target: start ? `${start.ra} ${start.dec}` : '269.45 4.69',
        cooFrame: 'ICRSd',
        showReticle: false,
        showCooGridControl: false,
        showCooLocation: false, // no coordinate box: the panel shows the coordinates
        showFrame: false,
        showSimbadPointerControl: false,
        showLayersControl: false,
        showFullscreenControl: false,
        showShareControl: false,
        showSettingsControl: false,
        showProjectionControl: false,
        showContextMenu: false,
        inertia: true, // the sky keeps gliding after you let go
      })
      aladinRef.current = aladin
      simRef.current.base = base
      window.skyshiftAladin = aladin // handy for debugging in the browser console

      // SPHEREx layer on top of the base map, only when zoomed in. While its (slower) tiles
      // arrive, the base map shows underneath, so the view never goes blank.
      let spherexOn = false
      const updateLayers = (fov) => {
        const wantSpherex = fov <= SPHEREX_MAX_FOV
        if (wantSpherex === spherexOn) return
        spherexOn = wantSpherex
        setSkyLayer(wantSpherex ? 'spherex' : 'base')
        if (wantSpherex) {
          const layer = A.imageHiPS(SPHEREX_SURVEY, { name: 'SPHEREx DR1 all-sky' })
          aladin.setOverlayImageLayer(layer, 'spherex')
          simRef.current.spherex = layer
          const pickSlice = (tries = 0) => {
            if (layer.added) {
              layer.setSliceNumber(SPHEREX_SLICE)
              if (simRef.current.dark) layer.setOpacity(0)
            }
            else if (tries < 50) setTimeout(() => pickSlice(tries + 1), 100)
          }
          pickSlice()
        } else {
          aladin.removeImageLayer('spherex')
        }
      }
      updateLayers(aladin.getFov()[0])
      // Aladin keeps one callback per event, so every zoom reaction goes here.
      // Guard: during the first seconds, if the base map pushes its own wide default view,
      // put back the view from the link.
      // The guard stays on until the user touches the map or uses the search/tour (max 30 s).
      const guardUntil = Date.now() + 30000
      const stopGuard = () => (interactedRef.current = true)
      ;['pointerdown', 'wheel', 'touchstart'].forEach((ev) =>
        mapRef.current.addEventListener(ev, stopGuard, { passive: true, once: true }),
      )
      aladin.on('zoomChanged', (fov) => {
        const f = Array.isArray(fov) ? fov[0] : fov
        if (start && !interactedRef.current && Date.now() < guardUntil && f > start.fov * 5) {
          aladin.gotoRaDec(start.ra, start.dec)
          aladin.setFoV(start.fov)
          return
        }
        updateLayers(f)
        cooHub.view()
        if (gaiaRef.current.on) gaiaRef.current.refresh()
      })

      simRef.current.trail = A.catalog({ name: 'Simulated path', shape: 'circle', color: 'rgba(230,232,235,0.55)', sourceSize: 5 })
      simRef.current.marker = A.catalog({ name: 'Simulated position', shape: 'circle', color: '#f5c451', sourceSize: 14 })
      aladin.addCatalog(simRef.current.trail)
      aladin.addCatalog(simRef.current.marker)
      dateMarkerRef.current = A.catalog({
        name: 'Position on the sky date',
        shape: 'cross',
        color: '#7fd8ff',
        sourceSize: 18,
        displayLabel: true,
        labelColumn: 'label',
        labelColor: '#7fd8ff',
        labelFont: '12px Archivo, system-ui, sans-serif',
      })
      aladin.addCatalog(dateMarkerRef.current)
      const markers = A.catalog({
        name: 'Selected spot',
        // Circle drawn by hand so its label sits UNDER it: Aladin always writes labels to the right of the
        // source, where the "Position on <date>" label of the moving object's cross already is.
        shape: (src, ctx) => {
          ctx.strokeStyle = '#7fd8ff'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(src.x, src.y, 12, 0, 2 * Math.PI)
          ctx.stroke()
          const label = src.data?.label
          if (label) {
            ctx.font = '13px Archivo, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.lineWidth = 3
            ctx.strokeStyle = 'rgba(7, 11, 24, 0.85)'
            ctx.strokeText(label, src.x, src.y + 17)
            ctx.fillStyle = '#7fd8ff'
            ctx.fillText(label, src.x, src.y + 17)
          }
        },
        color: '#7fd8ff',
        sourceSize: 24,
      })
      aladin.addCatalog(markers)
      markerLayerRef.current = markers
      if (start) {
        const startMoves = TOUR.find((t) => t.id === new URLSearchParams(window.location.search).get('object'))?.kind === 'moves'
        markers.addSources([A.source(start.ra, start.dec, { label: startMoves ? catalogueLabel() : '' })])
      }

      // Gaia DR3 layer: stars moved to the SPHEREx epoch with their proper motion.
      // One layer per colour bin (BP-RP), plus one for stars without a measured colour.
      const gaiaCats = [...GAIA_BINS.map((b) => b.color), GAIA_NO_COLOUR].map((color, i) => {
        const cat = A.catalog({ name: `Gaia DR3 G<16, moved to 2026.0 (${i})`, shape: 'circle', color, sourceSize: 10 })
        aladin.addCatalog(cat)
        return cat
      })
      const gaiaCat = { removeAll: () => gaiaCats.forEach((c) => c.removeAll()) }
      let gaiaTimer = null
      let gaiaSeq = 0
      const refreshGaia = () => {
        clearTimeout(gaiaTimer)
        gaiaTimer = setTimeout(async () => {
          gaiaCat.removeAll()
          if (!gaiaRef.current.on) {
            setGaiaStar(null)
            return setGaiaStatus(null)
          }
          const fov = aladin.getFov()[0]
          if (fov > GAIA_MAX_FOV) return setGaiaStatus({ key: 'zoom in to load' })
          const [ra, dec] = aladin.getRaDec()
          const seq = ++gaiaSeq
          setGaiaStatus({ key: 'loading…' })
          try {
            const ctrl = new AbortController()
            const t = setTimeout(() => ctrl.abort(), 12000) // never hang the page
            const r = await fetch(`/api/gaia?ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}&r=${Math.min(fov * 0.75, 0.5).toFixed(3)}`, {
              signal: ctrl.signal,
            })
            clearTimeout(t)
            if (!r.ok) throw new Error(r.status)
            const data = await r.json()
            if (seq !== gaiaSeq || !gaiaRef.current.on) return
            gaiaRef.current.data = data
            gaiaRef.current.draw()
            setGaiaStatus({ key: '{count} stars, G < 16', vars: { count: data.count } })
          } catch {
            if (seq === gaiaSeq) setGaiaStatus({ key: 'Gaia archive not answering, try later' })
          }
        }, 700)
      }
      // Draw the last Gaia answer at the current sky date (also called when the date changes).
      gaiaRef.current.draw = () => {
        const data = gaiaRef.current.data
        gaiaCats.forEach((c) => c.removeAll())
        if (!data || !gaiaRef.current.on) return
        {
            const byBin = gaiaCats.map(() => [])
            data.stars.forEach((s) => {
              const [sra, sdec] = moveToEpoch(s)
              const bin = binFor(s[5])
              const star = { G: s[4], pmra: s[2], pmdec: s[3], bp_rp: s[5], parallax: s[6], designation: s[7] }
              byBin[bin < 0 ? gaiaCats.length - 1 : bin].push(A.source(sra, sdec, star))
            })
            byBin.forEach((list, i) => list.length && gaiaCats[i].addSources(list))
        }
      }
      gaiaRef.current.refresh = refreshGaia
      aladin.on('positionChanged', () => {
        cooHub.view()
        if (gaiaRef.current.on) refreshGaia()
      })
      aladin.on('mouseMove', (d) => cooHub.cursor(d))
      // Click on a Gaia star: show its card (name, colour, parallax, motion).
      aladin.on('objectClicked', (obj) => {
        if (obj?.data?.designation) setGaiaStar(obj.data)
        if (obj?.data?.designation || obj?.data?.candidate) objectClickRef.current = Date.now()
        if (obj?.data?.candidate) {
          const c = obj.data.candidate
          selectSpot(c.position.ra_deg, c.position.dec_deg)
          setCandidate(c)
        }
      })

      // Community candidates approved by the team: science/candidates/index.json lists their files
      // (["candidate-....json", ...] or [{ "file": "..." }]). Optional: if it is not there, nothing shows.
      const CAND_BASE = 'https://raw.githubusercontent.com/teoaguiilar/skyshift/main/science/candidates'
      const candCat = A.catalog({
        name: 'Community candidates (approved)',
        shape: 'square',
        color: '#f5c451',
        sourceSize: 16,
        displayLabel: true,
        labelColumn: 'label',
        labelColor: '#f5c451',
        labelFont: '12px Archivo, system-ui, sans-serif',
      })
      aladin.addCatalog(candCat)
      fetch(`${CAND_BASE}/index.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : []))
        .then((list) =>
          Promise.all(
            (Array.isArray(list) ? list : []).slice(0, 200).map((item) => {
              const file = typeof item === 'string' ? item : item?.file
              if (!file || !/^[\w.+-]+\.json$/.test(file)) return null
              return fetch(`${CAND_BASE}/${file}`, { cache: 'no-cache' })
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null)
            }),
          ),
        )
        .then((cards) => {
          const ok = (cards ?? []).filter((c) => c && Number.isFinite(c.position?.ra_deg) && Number.isFinite(c.position?.dec_deg))
          candCat.addSources(ok.map((c) => A.source(c.position.ra_deg, c.position.dec_deg, { label: c.name, candidate: c })))
        })
        .catch(() => {})

      // A link with only ?object=<id> (e.g. the QR code) flies straight to that object.
      const linkedId = new URLSearchParams(window.location.search).get('object')
      const linked = TOUR.find((t) => t.id === linkedId)
      // When the base map finishes loading, Aladin jumps to the map's own default view
      // (the whole sky). Put back the view from the link once that has happened.
      const restoreView = (tries = 0) => {
        if (!base.added && tries < 100) return setTimeout(() => restoreView(tries + 1), 100)
        setTimeout(() => {
          if (interactedRef.current) return // the user already moved on: do not pull the view back
          if (start) {
            aladin.gotoRaDec(start.ra, start.dec)
            aladin.setFoV(start.fov)
          } else if (linked) {
            goTo(linked.query, linked.id)
            // On phones the player is below the map: glide down to it once the flight is done.
            if (isPhone()) setTimeout(showPanel, 4500)
          }
        }, 400)
      }
      restoreView()

      // Click anywhere on the sky (not while dragging) to choose that spot.
      aladin.on('click', (e) => {
        if (!e || e.isDragging) return
        if (Date.now() - objectClickRef.current < 400) return // the click was on a star or a candidate
        selectSpot(e.ra, e.dec)
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const skyMjd = player?.mjd ?? freeMjd
  useEffect(() => {
    skyEpoch.year = skyMjd ? mjdToYear(skyMjd) : 2026.0
    gaiaRef.current.draw?.()
    // The selected moving star, where it is on the sky date (catalogue proper motion + parallax).
    const cat = dateMarkerRef.current
    if (!cat) return
    cat.removeAll()
    const tg = player?.target
    if (!skyMjd || player?.kind !== 'moves' || !Number.isFinite(tg?.pmra_mas_yr)) return
    const year = mjdToYear(skyMjd)
    const [pe, pn] = parallaxShift(tg.ra_j2000_deg, tg.dec_j2000_deg, Number.isFinite(tg.parallax_mas) ? tg.parallax_mas : 0, year)
    const cosd = Math.cos((tg.dec_j2000_deg * Math.PI) / 180)
    const dec = tg.dec_j2000_deg + (tg.pmdec_mas_yr * (year - 2000) + pn) / 3.6e6
    const ra = tg.ra_j2000_deg + (tg.pmra_mas_yr * (year - 2000) + pe) / 3.6e6 / cosd
    cat.addSources([A.source(ra, dec, { label: t('Position on {date}', { date: mjdToDate(skyMjd).toISOString().slice(0, 10) }) })])
  }, [skyMjd, player?.target, player?.kind, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stellarium-like flight: zoom out a bit, glide across the sky, then zoom in.
  function flyTo(ra, dec, fov = DEFAULT_FOV, objectId = null) {
    const aladin = aladinRef.current
    if (!aladin) return
    interactedRef.current = true
    selectSpot(ra, dec, fov, objectId)
    const current = aladin.getFov()[0]
    const glide = () => aladin.animateToRaDec(ra, dec, 1.6, () => aladin.zoomToFoV(fov, 1.4))
    if (current < 20) aladin.zoomToFoV(20, 0.8, glide)
    else glide()
  }

  function goTo(text, objectId = null) {
    const aladin = aladinRef.current
    if (!aladin || !text.trim()) return
    const coords = parseCoords(text)
    if (coords) {
      setStatus('')
      loadTourTargets().then((targets) => {
        const hit = tourObjectAt(coords.ra, coords.dec, targets)
        if (hit) flyTo(hit.ra, hit.dec, DEFAULT_FOV, hit.id)
        else flyTo(coords.ra, coords.dec)
      })
      return
    }
    // Typing the name of a guided-tour object opens its full panel (time-lapse, charts, card), not just the spot.
    if (!objectId) {
      const tourObj = tourObjectFor(text)
      if (tourObj) {
        text = tourObj.query
        objectId = tourObj.id
      }
    }
    setStatus(t('Searching “{text}”…', { text }))
    resolveName(text)
      .then(({ ra, dec }) => {
        flyTo(ra, dec, DEFAULT_FOV, objectId)
        setStatus('')
      })
      .catch(() => setStatus(t('“{text}” not found. Try another name, or coordinates such as 269.45 4.69, 17 57 48 +04 41 36 or gal 31.0 14.1.', { text })))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo size={30} />
          <span className="brand-tag small-label">{t('See the sky move')}</span>
        </div>
        <div className="seg mode-switch" role="tablist" aria-label="Mode">
          <button className={!science ? 'on' : ''} onClick={() => setMode('explore')} role="tab" aria-selected={!science}>
            {t('Explore')}
          </button>
          <button className={science ? 'on' : ''} onClick={() => setMode('science')} role="tab" aria-selected={science}>
            {t('Science')}
          </button>
        </div>
        <div className="seg lang-switch" role="tablist" aria-label="Language / Idioma">
          {['en', 'es'].map((l) => (
            <button key={l} className={lang === l ? 'on' : ''} onClick={() => changeLang(l)} role="tab" aria-selected={lang === l}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            goTo(query)
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Name or coordinates, e.g. 17 57 48 +04 41 36')}
            aria-label={t('Search the sky')}
          />
          <button type="submit" className="btn search-go">
            {t('Go')}
          </button>
        </form>
        <button className="help-btn" onClick={() => setTutorial(tutorialFor(mode))} aria-label={t('Show the tutorial')} title={t('Tutorial')}>
          ?
        </button>
      </header>

      <nav className="tour" aria-label="Guided tour">
        <span className="small-label tour-label">{t('Guided tour')}</span>
        {TOUR.map((t) => (
          <button
            key={t.label}
            className={`tour-obj ${t.kind}`}
            aria-pressed={activeId === t.id}
            onClick={() => goTo(t.query, t.id)}
          >
            <img src={thumbOf(t)} alt="" decoding="async" />
            <span className="tour-text">
              <span>{t.label}</span>
              <span className={`tag ${t.kind}`}>{t.kind === 'moves' ? tr('Moves') : tr('Changes brightness')}</span>
            </span>
          </button>
        ))}
      </nav>

      <main className="stage">
        <div className="map-wrap">
          <div ref={mapRef} className="map" onMouseLeave={() => cooHub.cursor(null)} />
          {science && <CooBar aladinRef={aladinRef} hub={cooHub} />}
          {science && (
          <div className="gaia-toggle">
          <label>
            <input
              type="checkbox"
              checked={gaiaOn}
              onChange={(e) => {
                setGaiaOn(e.target.checked)
                gaiaRef.current.on = e.target.checked
                gaiaRef.current.refresh()
              }}
            />
            {t('Gaia DR3 stars (ESA)')}{gaiaOn && gaiaStatus ? ` · ${t(gaiaStatus.key, gaiaStatus.vars)}` : ''}
          </label>
            {gaiaOn && (
              <span className="gaia-legend">
                <span className="muted">{t('colour BP−RP:')}</span>
                {GAIA_BINS.map((b) => (
                  <span key={b.label}>
                    <i style={{ borderColor: b.color }} />
                    {b.label}
                  </span>
                ))}
                <span className="muted">{t('hotter → cooler · click a star')}</span>
              </span>
            )}
          </div>
          )}
          {science && gaiaStar && <GaiaStar star={gaiaStar} onClose={() => setGaiaStar(null)} />}
          {simLabel && (
            <div className="sim-label">
              <span className="sim-year">{t('Year')} {simLabel.phase === 'close' ? simLabel.year.toFixed(2) : Math.round(simLabel.year)}</span>
              {simLabel.phase === 'close' ? (
                <span>
                  {t(
                    'Close-up, 2 years (view {view} wide): {name} drifts with its proper motion and wobbles once a year by its parallax (±{wobble} mas), because we watch it from the moving Earth.',
                    { view: simLabel.view, name: simLabel.name, wobble: simLabel.wobble.toFixed(simLabel.wobble < 10 ? 2 : 0) },
                  )}{' '}
                  {t('The sky images are hidden: this view is smaller than one pixel of the map.')}
                </span>
              ) : (
                <span>
                  {t('{years} years (view {view} wide): {name} moves {moved}; the yearly wobble is now far too small to see.', {
                    years: simLabel.years.toLocaleString(getLang()),
                    view: simLabel.view,
                    name: simLabel.name,
                    moved: simLabel.moved >= 60 ? `${(simLabel.moved / 60).toFixed(1)}′` : `${simLabel.moved.toFixed(1)}″`,
                  })}
                </span>
              )}
              <span className="muted">
                {t('Simulation from catalogue values (SIMBAD); other stars are shown where they are today.')}
              </span>
              {science && (
                <code className="sim-eq">
                  Δα·cosδ = μα*·Δt + ϖ(X sinα − Y cosα) · Δδ = μδ·Δt + ϖ(X cosα sinδ + Y sinα sinδ − Z cosδ)
                </code>
              )}
              <button className="sim-pause" onClick={toggleSimPause}>
                {simPaused ? t('Play') : t('Pause')}
              </button>
              <button onClick={clearSim} aria-label={t('Close the simulation')}>
                ×
              </button>
            </div>
          )}
          {!simLabel && <DateControl
            player={player}
            value={freeMjd}
            onPick={(mjd) => setRequestMjd({ mjd, n: Date.now() })}
            onFree={setFreeMjd}
          />}
          <span className="sky-layer">
            {skyLayer === 'spherex' ? t('Sky: NASA SPHEREx (all-sky map)') : t('Sky: NASA WISE · zoom in to see SPHEREx')}
          </span>
        </div>
        {activeId && !scrolledDown && !simLabel && (
          <button className="to-panel" onClick={showPanel}>
            {t('▼ Time-lapse below')}
          </button>
        )}
        <aside className="panel" ref={panelRef}>
          {activeId ? (
            <>
              <h2>{TOUR.find((t) => t.id === activeId)?.label ?? 'Object'}</h2>
              {(() => {
                const t = TOUR.find((x) => x.id === activeId)
                return (
                  <TimeLapse
                    id={activeId}
                    kind={t?.kind}
                    cardId={t?.card}
                    note={t?.note}
                    hideSpectrum={t?.hideSpectrum}
                    spectrumNote={t?.spectrumNote}
                    startFalseColor={t?.startFalseColor}
                    science={science}
                    objectName={t?.label}
                    onFrameChange={setPlayer}
                    requestMjd={requestMjd}
                    onSimulate={(target, years, plx) => simulate(target, years, plx)}
                  />
                )
              })()}
            </>
          ) : (
            <>
              <h2>{candidate ? `${t('Community candidate')}: ${candidate.name}` : selected ? t('Selected spot') : t('Start here')}</h2>
              {candidate && <ObjectCard card={candidate} />}
              {candidate && (
                <div className="actions">
                  <DiscussButton name={candidate.name} />
                </div>
              )}
              {selected ? (
                <dl className="coords">
                  <dt>RA</dt>
                  <dd>{selected.ra.toFixed(5)}°</dd>
                  <dt>Dec</dt>
                  <dd>{selected.dec.toFixed(5)}°</dd>
                </dl>
              ) : (
                <div className="start-here">
                  {START_HERE.map((s) => {
                    const obj = TOUR.find((x) => x.id === s.id)
                    return (
                      <button key={s.id} className="start-card" onClick={() => goTo(obj.query, obj.id)}>
                        <img src={thumbOf(obj)} alt="" />
                        <span>
                          <strong>{obj.label}</strong>
                          <span className="muted">{t(s.text)}</span>
                        </span>
                      </button>
                    )
                  })}
                  <p className="hint">{t('Or drag and zoom the map and click any point of the sky to see its SPHEREx images.')}</p>
                </div>
              )}
              {selected && (
                <SpotLapse ra={selected.ra} dec={selected.dec} science={science} onFrameChange={setPlayer} requestMjd={requestMjd} />
              )}
            </>
          )}
          {status && <p className="status">{status}</p>}
          <p className="credits">
            {t(
              'Data: NASA SPHEREx (IRSA) · NASA WISE (ESA HiPS mirror) · ESA Gaia DR3 (optional layer, positions moved to 2026.0 with their proper motion) · object names: CDS Sesame. Sky map: Aladin Lite (CDS). Team SkyShift Murcia · NASA Space Apps Challenge 2026.',
            )}
            {getLang() === 'es' && <span className="credits-lang"> {t('Scientific texts and notes from the team are in English.')}</span>}
          </p>
          <p className="credits">
            {t('Community: talk about any object, add information or point out errors in')}{' '}
            <a href={DISCUSSIONS} target="_blank" rel="noopener noreferrer">
              {t('SkyShift Discussions (GitHub)')}
            </a>
            .
          </p>
        </aside>
      </main>

      {showIntro && (
        <Intro
          tour={TOUR.map((t) => ({ id: t.id, label: t.label, thumb: thumbOf(t) }))}
          onLeave={onIntroLeave}
          onStart={onIntroStart}
          lang={lang}
          onLang={changeLang}
        />
      )}
      {tutorial && <Tutorial steps={tutorial} onClose={() => setTutorial(null)} />}
    </div>
  )
}
