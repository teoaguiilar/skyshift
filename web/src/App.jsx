/*
 * SkyShift — sky map (Minimum level).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
 * See AI_USAGE.md. Sky map: Aladin Lite (CDS, LGPL-3.0) — see SOURCES.md.
 */
import { useEffect, useRef, useState } from 'react'
import A from 'aladin-lite'
import TimeLapse from './TimeLapse.jsx'
import SpotLapse from './SpotLapse.jsx'
import ObjectCard from './ObjectCard.jsx'
import SpectrumPanel from './SpectrumPanel.jsx'
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
    hideSpectrum: true, // contaminated below 3 µm, under review by Benjamín
    label: 'WISE 0855−0714',
    query: 'WISE J085510.83-071442.5',
    kind: 'moves',
    note: 'Too faint in single images: SkyShift stacks all SPHEREx images of each visit to reveal it.',
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

const DEFAULT_FOV = 0.5 // degrees

// Fast base map for smooth navigation: AllWISE colour infrared sky (NASA WISE data),
// served from ESA's HiPS mirror, which answers about 4x faster than IRSA from Europe.
const BASE_SURVEY = 'https://skies.esac.esa.int/AllWISEColor'
// SPHEREx DR1 all-sky data cube (HiPS) from NASA/IPAC IRSA, laid on top when zoomed in.
const SPHEREX_SURVEY = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube'
// The cube has one image per wavelength. Temporary choice; the data team picks the final one.
const SPHEREX_SLICE = 30
const SPHEREX_MAX_FOV = 15 // degrees: SPHEREx layer appears below this field of view

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

function writeUrl(ra, dec, fov, objectId) {
  const p = new URLSearchParams()
  if (objectId) p.set('object', objectId)
  p.set('ra', ra.toFixed(5))
  p.set('dec', dec.toFixed(5))
  p.set('fov', fov.toFixed(3))
  window.history.replaceState(null, '', `?${p.toString()}`)
}

// "269.45 4.69" or "269.45, 4.69" -> numbers; anything else is treated as a name.
function parseCoords(text) {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)[\s,]+([+-]?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const ra = parseFloat(m[1])
  const dec = parseFloat(m[2])
  if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) return null
  return { ra, dec }
}

export default function App() {
  const mapRef = useRef(null)
  const aladinRef = useRef(null)
  const markerLayerRef = useRef(null)
  const [selected, setSelected] = useState(readUrl())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [skyLayer, setSkyLayer] = useState('base')
  const panelRef = useRef(null)
  const [scrolledDown, setScrolledDown] = useState(false)
  const isPhone = () => window.matchMedia('(max-width: 760px)').matches
  const showPanel = () => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useEffect(() => {
    const onScroll = () => setScrolledDown(window.scrollY > 200)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const [activeId, setActiveId] = useState(() => new URLSearchParams(window.location.search).get('object'))

  // Select a sky position: marker + URL + panel.
  function selectSpot(ra, dec, fovOverride, objectId = null) {
    const aladin = aladinRef.current
    if (!aladin) return
    const fov = fovOverride ?? aladin.getFov()[0]
    markerLayerRef.current.removeAll()
    markerLayerRef.current.addSources([A.source(ra, dec)])
    writeUrl(ra, dec, fov, objectId)
    setSelected({ ra, dec, fov })
    setActiveId(objectId)
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
        showCooGridControl: true,
        showSimbadPointerControl: false,
        showLayersControl: true,
        showFullscreenControl: false,
        showShareControl: false,
        showSettingsControl: false,
        showProjectionControl: false,
        showContextMenu: false,
        showFrame: true,
        inertia: true, // the sky keeps gliding after you let go
      })
      aladinRef.current = aladin
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
          const pickSlice = (tries = 0) => {
            if (layer.added) layer.setSliceNumber(SPHEREX_SLICE)
            else if (tries < 50) setTimeout(() => pickSlice(tries + 1), 100)
          }
          pickSlice()
        } else {
          aladin.removeImageLayer('spherex')
        }
      }
      updateLayers(aladin.getFov()[0])
      aladin.on('zoomChanged', (fov) => updateLayers(Array.isArray(fov) ? fov[0] : fov))

      const markers = A.catalog({ name: 'Selected spot', shape: 'circle', color: '#ff7a3d', sourceSize: 24 })
      aladin.addCatalog(markers)
      markerLayerRef.current = markers
      if (start) markers.addSources([A.source(start.ra, start.dec)])

      // A link with only ?object=<id> (e.g. the QR code) flies straight to that object.
      const linkedId = new URLSearchParams(window.location.search).get('object')
      const linked = TOUR.find((t) => t.id === linkedId)
      // When the base map finishes loading, Aladin jumps to the map's own default view
      // (the whole sky). Put back the view from the link once that has happened.
      const restoreView = (tries = 0) => {
        if (!base.added && tries < 100) return setTimeout(() => restoreView(tries + 1), 100)
        setTimeout(() => {
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
        selectSpot(e.ra, e.dec)
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Stellarium-like flight: zoom out a bit, glide across the sky, then zoom in.
  function flyTo(ra, dec, fov = DEFAULT_FOV, objectId = null) {
    const aladin = aladinRef.current
    if (!aladin) return
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
      flyTo(coords.ra, coords.dec)
      setStatus('')
      return
    }
    setStatus(`Searching “${text}”…`)
    resolveName(text)
      .then(({ ra, dec }) => {
        flyTo(ra, dec, DEFAULT_FOV, objectId)
        setStatus('')
      })
      .catch(() => setStatus(`“${text}” not found. Try another name or "RA Dec" in degrees.`))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">SkyShift</span>
          <span className="brand-tag">see the sky move</span>
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
            placeholder="Object name or RA Dec (degrees)"
            aria-label="Search the sky"
          />
          <button type="submit">Go</button>
        </form>
      </header>

      <nav className="tour" aria-label="Guided tour">
        <span className="tour-label">Guided tour</span>
        <span className="tour-legend">
          <span className="key moves" /> moves <span className="key varies" /> changes brightness
        </span>
        {TOUR.map((t) => (
          <button key={t.label} className={`tour-btn ${t.kind}${activeId === t.id ? ' active' : ''}`} onClick={() => goTo(t.query, t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="stage">
        <div className="map-wrap">
          <div ref={mapRef} className="map" />
          <span className="sky-layer">
            {skyLayer === 'spherex' ? 'Sky: NASA SPHEREx (all-sky map)' : 'Sky: NASA WISE · zoom in to see SPHEREx'}
          </span>
        </div>
        {activeId && !scrolledDown && (
          <button className="to-panel" onClick={showPanel}>
            ▼ Time-lapse below
          </button>
        )}
        <aside className="panel" ref={panelRef}>
          {activeId ? (
            <>
              <h2>{TOUR.find((t) => t.id === activeId)?.label ?? 'Object'}</h2>
              <TimeLapse id={activeId} kind={TOUR.find((t) => t.id === activeId)?.kind} />
              {TOUR.find((t) => t.id === activeId)?.note && (
                <p className="status">{TOUR.find((t) => t.id === activeId).note}</p>
              )}
              {!TOUR.find((t) => t.id === activeId)?.hideSpectrum && (
                <SpectrumPanel
                  id={TOUR.find((t) => t.id === activeId)?.card ?? activeId}
                  note={TOUR.find((t) => t.id === activeId)?.spectrumNote}
                />
              )}
              <ObjectCard id={TOUR.find((t) => t.id === activeId)?.card ?? activeId} />
            </>
          ) : (
            <>
              <h2>Selected spot</h2>
              {selected ? (
                <dl className="coords">
                  <dt>RA</dt>
                  <dd>{selected.ra.toFixed(5)}°</dd>
                  <dt>Dec</dt>
                  <dd>{selected.dec.toFixed(5)}°</dd>
                </dl>
              ) : (
                <p className="hint">Drag and zoom the map, then click any point of the sky — or pick a guided tour.</p>
              )}
              {selected && <SpotLapse ra={selected.ra} dec={selected.dec} />}
            </>
          )}
          {status && <p className="status">{status}</p>}
        </aside>
      </main>
    </div>
  )
}
