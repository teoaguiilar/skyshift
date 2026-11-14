/*
 * SkyShift — sky map (Minimum level).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
 * See AI_USAGE.md. Sky map: Aladin Lite (CDS, LGPL-3.0) — see SOURCES.md.
 */
import { useEffect, useRef, useState } from 'react'
import A from 'aladin-lite'
import './App.css'

// The five test objects of the challenge, resolved by name through CDS Sesame.
const TOUR = [
  { label: "Barnard's Star", query: "Barnard's star", kind: 'moves' },
  { label: 'Epsilon Indi B', query: 'eps Ind B', kind: 'moves' },
  { label: 'WISE 0855−0714', query: 'WISE J085510.83-071442.5', kind: 'moves' },
  { label: 'RW Aurigae', query: 'RW Aur', kind: 'varies' },
  { label: 'R Draconis', query: 'R Dra', kind: 'varies' },
]

const DEFAULT_FOV = 0.5 // degrees

// Background sky: SPHEREx DR1 all-sky data cube (HiPS) served by NASA/IPAC IRSA.
const BACKGROUND_SURVEY = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube'
// The cube has one image per wavelength. Temporary choice; the data team picks the final one.
const BACKGROUND_SLICE = 30

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

function writeUrl(ra, dec, fov) {
  const p = new URLSearchParams()
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

  // Select a sky position: marker + URL + panel.
  function selectSpot(ra, dec) {
    const aladin = aladinRef.current
    if (!aladin) return
    const fov = aladin.getFov()[0]
    markerLayerRef.current.removeAll()
    markerLayerRef.current.addSources([A.source(ra, dec)])
    writeUrl(ra, dec, fov)
    setSelected({ ra, dec, fov })
  }

  useEffect(() => {
    let cancelled = false
    A.init.then(() => {
      if (cancelled || aladinRef.current) return
      const start = readUrl()
      const background = A.imageHiPS(BACKGROUND_SURVEY, { name: 'SPHEREx DR1 all-sky' })
      const aladin = A.aladin(mapRef.current, {
        survey: background, // SPHEREx infrared background map
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

      // Choose the wavelength slice once the cube layer has been added.
      const pickSlice = (tries = 0) => {
        if (background.added) background.setSliceNumber(BACKGROUND_SLICE)
        else if (tries < 50) setTimeout(() => pickSlice(tries + 1), 100)
      }
      pickSlice()

      const markers = A.catalog({ name: 'Selected spot', shape: 'circle', color: '#ff7a3d', sourceSize: 24 })
      aladin.addCatalog(markers)
      markerLayerRef.current = markers
      if (start) markers.addSources([A.source(start.ra, start.dec)])

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
  function flyTo(ra, dec, fov = DEFAULT_FOV) {
    const aladin = aladinRef.current
    if (!aladin) return
    selectSpot(ra, dec)
    const current = aladin.getFov()[0]
    const glide = () => aladin.animateToRaDec(ra, dec, 1.6, () => aladin.zoomToFoV(fov, 1.4))
    if (current < 20) aladin.zoomToFoV(20, 0.8, glide)
    else glide()
  }

  function goTo(text) {
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
        flyTo(ra, dec)
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
        {TOUR.map((t) => (
          <button key={t.label} className={`tour-btn ${t.kind}`} onClick={() => goTo(t.query)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="stage">
        <div ref={mapRef} className="map" />
        <aside className="panel">
          <h2>Selected spot</h2>
          {selected ? (
            <dl className="coords">
              <dt>RA</dt>
              <dd>{selected.ra.toFixed(5)}°</dd>
              <dt>Dec</dt>
              <dd>{selected.dec.toFixed(5)}°</dd>
            </dl>
          ) : (
            <p className="hint">Drag and zoom the map, then click any point of the sky.</p>
          )}
          <p className="hint">SPHEREx images for this spot will appear here.</p>
          {status && <p className="status">{status}</p>}
        </aside>
      </main>
    </div>
  )
}
