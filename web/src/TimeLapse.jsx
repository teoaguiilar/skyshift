/*
 * SkyShift — SPHEREx time-lapse player for one object (or for any clicked spot).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Reads, from the public GitHub repo (pipeline by Teo, texts by the science team):
 *   data/<id>/manifest.json + PNG frames, data/<id>/difference.json, data/<id>/false_color.json,
 *   data/<card>/spectrum.json,
 *   science/cards/<card>.json.
 * Every number shown comes from those files; nothing is typed in by hand here.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { BrightnessChart, PositionChart, SpectrumChart, hasBrightness, hasPosition } from './Charts.jsx'
import ObjectCard from './ObjectCard.jsx'
import Frame, { FrameOverlay } from './Frame.jsx'
import UpClose, { hasUpClose } from './UpClose.jsx'
import Parallax, { usedParallax } from './Parallax.jsx'
import { StarIcon } from './Logo.jsx'

const REPO_RAW = 'https://raw.githubusercontent.com/teoaguiilar/skyshift/main'
const DATA_BASE = `${REPO_RAW}/data`
const CARDS_BASE = `${REPO_RAW}/science/cards`
const VIEW_SIZE = 340 // px on screen

// "Report a candidate": opens a pre-filled GitHub Issue. SkyShift collects no personal data;
// the discussion happens in the Issue comments and the team moderates it.
const ISSUES_URL = 'https://github.com/teoaguiilar/skyshift/issues/new'
function reportUrl(manifest, frame) {
  const g = manifest.grid
  const first = manifest.frames[0].date
  const last = manifest.frames[manifest.frames.length - 1].date
  const body = [
    `**Where:** RA ${g.center_ra_deg.toFixed(5)}°, Dec ${g.center_dec_deg.toFixed(5)}° (${manifest.name})`,
    `**SPHEREx data:** band ${manifest.band}, about ${Number(manifest.wavelength_um).toFixed(2)} µm, ${manifest.frames.length} images from ${first} to ${last}`,
    `**Image I was looking at:** ${frame.date}`,
    `**Link:** ${window.location.href}`,
    '',
    '**What do you see?** (something that moves between dates, or changes brightness)',
    '',
    '**Evidence:** (which dates/images show it; did you check Gaia DR3, SIMBAD or another catalogue?)',
    '',
    '_Please do not include personal data. A candidate is not a discovery until it is checked._',
  ].join('\n')
  const q = new URLSearchParams({ title: `Candidate near RA ${g.center_ra_deg.toFixed(3)}, Dec ${g.center_dec_deg.toFixed(3)}`, body })
  return `${ISSUES_URL}?${q.toString()}`
}

// Frames from data/ have a file name; frames built in the browser carry their own image (src).
const srcOf = (f, id) => f.src ?? `${DATA_BASE}/${id}/${f.file}`

// Sky position -> pixel in the PNG (north up, east left).
function skyToPixel(ra, dec, grid) {
  const scale = grid.pixel_scale_arcsec / grid.png_upscale // arcsec per PNG pixel
  const cosDec = Math.cos((grid.center_dec_deg * Math.PI) / 180)
  const dx = ((ra - grid.center_ra_deg) * cosDec * 3600) / scale
  const dy = ((dec - grid.center_dec_deg) * 3600) / scale
  const w = grid.width * grid.png_upscale
  const h = grid.height * grid.png_upscale
  return { x: w / 2 - dx, y: h / 2 - dy, w, h }
}

// science/cards/descriptions.json: { "<card id>": { "explore": "...", "science": "..." } }, by Benjamín.
// Optional: until it is on GitHub (or if it is broken) the About tab simply shows the card without it.
let descriptionsPromise = null
const loadDescriptions = () =>
  (descriptionsPromise ??= fetch(`${CARDS_BASE}/descriptions.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((d) => (d && typeof d === 'object' ? d : {}))
    .catch(() => ({})))

const getJson = (url) =>
  fetch(url, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)

// science = false (Explore mode): only the essentials. Science mode adds the measurements
// (charts, spectrum, wavelength, quality flags). Nothing is hidden that changes what the images mean:
// a flagged image is still marked as flagged in Explore.
// How many years to show in "Watch it move": the first of these in which the star shifts at least 2′
// (at most 10,000 years, where a straight-line path is still a fair picture).
function simYears(target) {
  const pm = Math.hypot(target.pmra_mas_yr, target.pmdec_mas_yr) // mas/yr
  return [100, 1000, 10000].find((y) => (pm * y) / 1000 >= 120) ?? 10000
}

export default function TimeLapse({ id, manifest: given, kind, cardId, note, hideSpectrum, spectrumNote, science = false, onSimulate }) {
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(false)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [showExpected, setShowExpected] = useState(false)
  const [difference, setDifference] = useState(null)
  const [falseColor, setFalseColor] = useState(null)
  const [spectrum, setSpectrum] = useState(null)
  const [card, setCard] = useState(null)
  const [descriptions, setDescriptions] = useState(null) // this object's {explore, science}, if any
  const [mode, setMode] = useState('frames') // 'frames' | 'difference' | 'false'
  const [tab, setTab] = useState(null) // info tab under the player
  const timer = useRef(null)

  // Main data: the frames.
  useEffect(() => {
    setManifest(null)
    setError(false)
    setIndex(0)
    setPlaying(true)
    if (given) {
      setManifest({ ...given, frames: [...given.frames].sort((a, b) => a.mjd - b.mjd) })
      return
    }
    getJson(`${DATA_BASE}/${id}/manifest.json`).then((m) => {
      if (!m) return setError(true)
      m.frames.sort((a, b) => a.mjd - b.mjd)
      m.frames.forEach((f) => {
        const img = new Image() // preload, so the animation does not flicker
        img.src = srcOf(f, id)
      })
      setManifest(m)
    })
  }, [id, given])

  // Extras made by the pipeline and the science team (each one optional).
  useEffect(() => {
    setDifference(null)
    setFalseColor(null)
    setSpectrum(null)
    setCard(null)
    setDescriptions(null)
    setMode('frames')
    setTab(null)
    if (given || !id) return
    const c = cardId ?? id
    getJson(`${DATA_BASE}/${id}/difference.json`).then(setDifference)
    getJson(`${DATA_BASE}/${id}/false_color.json`).then(setFalseColor)
    if (!hideSpectrum) getJson(`${DATA_BASE}/${c}/spectrum.json`).then(setSpectrum)
    getJson(`${CARDS_BASE}/${c}.json`).then(setCard)
    loadDescriptions().then((all) => {
      const d = all?.[c]
      if (d && (typeof d.explore === 'string' || typeof d.science === 'string')) setDescriptions(d)
    })
  }, [id, given, cardId, hideSpectrum])

  // False colour is a Science view: back to the frames when switching to Explore.
  useEffect(() => {
    if (!science) setMode((m) => (m === 'false' ? 'frames' : m))
  }, [science])

  useEffect(() => {
    clearInterval(timer.current)
    if (playing && mode === 'frames' && manifest && manifest.frames.length > 1) {
      timer.current = setInterval(() => setIndex((i) => (i + 1) % manifest.frames.length), 700)
    }
    return () => clearInterval(timer.current)
  }, [playing, manifest, mode])

  const frame = manifest?.frames[index]
  const expected = useMemo(() => {
    if (!frame?.predicted || !manifest) return null
    return skyToPixel(frame.predicted.ra_deg, frame.predicted.dec_deg, manifest.grid)
  }, [frame, manifest])

  if (error) return <p className="hint">SPHEREx time-lapse for this object is coming soon.</p>
  if (!manifest) return <p className="hint">Loading SPHEREx images…</p>

  const first = manifest.frames[0].date
  const last = manifest.frames[manifest.frames.length - 1].date
  const g = manifest.grid

  // Info tabs: only the ones with real data behind them.
  const tabs = []
  if (science && kind === 'moves' && hasPosition(manifest.frames)) tabs.push({ key: 'motion', label: 'Motion' })
  if (science && kind === 'varies' && hasBrightness(manifest.frames)) tabs.push({ key: 'brightness', label: 'Brightness' })
  if (science && spectrum?.binned?.length > 2) tabs.push({ key: 'spectrum', label: 'Spectrum' })
  // Description for the current mode (falls back to the other one if only one is written).
  const description = descriptions ? (science ? descriptions.science || descriptions.explore : descriptions.explore || descriptions.science) : null
  if (!given && Number.isFinite(manifest.target?.parallax_mas)) tabs.push({ key: 'parallax', label: 'Parallax' })
  if (!given && hasUpClose(cardId ?? id)) tabs.push({ key: 'upclose', label: 'Up close' })
  if (card || description) tabs.push({ key: 'about', label: 'About' })
  const activeTab = tabs.find((t) => t.key === tab)?.key ?? tabs[0]?.key

  return (
    <div className="timelapse">
      <div className="tl-head">
        <span className="small-label">SPHEREx time-lapse{manifest.stacked ? ', stacked visits' : ''}</span>
        {science && (
          <span className="status-meta">
            {manifest.band} · {Number(manifest.wavelength_um).toFixed(2)} µm
          </span>
        )}
      </div>

      {manifest.frames.length > 1 && (
        <div className="first-last">
          <div className="first-last-row">
            <Frame src={srcOf(manifest.frames[0], id)} grid={g} frame={manifest.frames[0]} label="First visit" size={148} />
            <span className="first-last-arrow" aria-hidden="true">
              →
            </span>
            <Frame
              src={srcOf(manifest.frames[manifest.frames.length - 1], id)}
              grid={g}
              frame={manifest.frames[manifest.frames.length - 1]}
              label="Latest visit"
              size={148}
            />
          </div>
          <p className="small-label">
            Real NASA SPHEREx images. North is up; each square is one {g.pixel_scale_arcsec}″ pixel.
            {manifest.frames.some((f) => f.measured && Number.isFinite(f.measured.ra_deg))
              ? ' The cyan marks show where SkyShift measured the object.'
              : ''}
          </p>
        </div>
      )}

      {(difference || (science && falseColor)) && (
        <div className="seg" role="tablist">
          <button className={mode === 'frames' ? 'on' : ''} onClick={() => setMode('frames')}>
            Frames
          </button>
          {difference && (
            <button className={mode === 'difference' ? 'on' : ''} onClick={() => setMode('difference')}>
              Difference
            </button>
          )}
          {science && falseColor && (
            <button className={mode === 'false' ? 'on' : ''} onClick={() => setMode('false')}>
              False colour
            </button>
          )}
        </div>
      )}

      {mode === 'false' && science && falseColor ? (
        <>
          <div className="tl-view" style={{ width: VIEW_SIZE, height: VIEW_SIZE }}>
            <img src={`${DATA_BASE}/${id}/${falseColor.file}`} alt={`${manifest.name}: SPHEREx infrared in false colour`} />
            <span className="tl-compass">N ↑ · E ←</span>
          </div>
          <ul className="fc-legend">
            {falseColor.legend.map((l) => (
              <li key={l.colour}>
                <span className={`fc-key ${l.colour}`} />
                {l.colour[0].toUpperCase() + l.colour.slice(1)} = {l.wavelengths_used_um[0].toFixed(2)}–
                {l.wavelengths_used_um[1].toFixed(2)} µm ({l.detector}) <span className="muted">· {l.images} images</span>
              </li>
            ))}
          </ul>
          <p className="hint">
            One visit: {falseColor.visit.from} → {falseColor.visit.to}. {falseColor.note}
          </p>
        </>
      ) : mode === 'difference' && difference ? (
        <>
          <div className="tl-view" style={{ width: VIEW_SIZE, height: VIEW_SIZE }}>
            <img src={`${DATA_BASE}/${id}/${difference.file}`} alt={`${manifest.name}: last SPHEREx visit minus the first one`} />
            <svg viewBox={`0 0 ${g.width * g.png_upscale} ${g.height * g.png_upscale}`} className="tl-overlay">
              {difference.visits.map((v) => (
                <circle
                  key={v.visit}
                  cx={(v.predicted_pixel.x + 0.5) * g.png_upscale}
                  cy={(g.height - (v.predicted_pixel.y + 0.5)) * g.png_upscale}
                  r="24"
                  className={v.visit === 'first' ? 'diff-first' : 'diff-last'}
                />
              ))}
            </svg>
            <span className="tl-compass">N ↑ · E ←</span>
          </div>
          <p className="hint">
            <span className="diff-key first" /> {difference.visits[0].date} → <span className="diff-key last" />{' '}
            {difference.visits[difference.visits.length - 1].date}. {difference.how_to_read} Circles: catalogue position.
          </p>
        </>
      ) : (
        <>
          <div className="tl-view" style={{ width: VIEW_SIZE, height: VIEW_SIZE }}>
            <img src={srcOf(frame, id)} alt={`${manifest.name}, SPHEREx image of ${frame.date}`} />
            <FrameOverlay size={VIEW_SIZE} grid={g} measured={frame.measured} />
            {showExpected && expected && (
              <svg viewBox={`0 0 ${expected.w} ${expected.h}`} className="tl-overlay">
                <circle cx={expected.x} cy={expected.y} r="22" />
              </svg>
            )}
            <span className="tl-compass">N ↑ · E ←</span>
          </div>

          <div className="tl-controls">
            <button className="btn tl-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause the time-lapse' : 'Play the time-lapse'}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min="0"
              max={manifest.frames.length - 1}
              value={index}
              onChange={(e) => {
                setPlaying(false)
                setIndex(Number(e.target.value))
              }}
              aria-label="Observation date"
            />
          </div>

          <dl className="coords tl-meta">
            <dt>Date</dt>
            <dd>
              {frame.date} <span className="muted">· {index + 1}/{manifest.frames.length}</span>
            </dd>
            {science && (
              <>
                <dt>λ</dt>
                <dd>
                  {frame.wavelength_range_um
                    ? `${frame.wavelength_range_um[0].toFixed(2)}–${frame.wavelength_range_um[1].toFixed(2)} µm`
                    : `${frame.wavelength_um.toFixed(3)} µm`}
                </dd>
              </>
            )}
            {science && frame.stacked_images && (
              <>
                <dt>Stack</dt>
                <dd>
                  {frame.stacked_images} images · S/N {frame.snr?.toFixed(1)} ·{' '}
                  <span className={frame.detected ? '' : 'warn'}>{frame.detected ? 'detected' : 'not detected'}</span>
                </dd>
              </>
            )}
            {science ? (
              <>
                <dt>Quality</dt>
                <dd>
                  <span className={`status-item ${frame.quality_ok && !frame.measured?.saturated ? 'status-ok' : 'status-warn'}`}>
                    <StarIcon />
                    {frame.measured?.saturated
                      ? `Saturated${frame.quality_ok ? ' (no bad-pixel flags)' : ' · Flagged'}`
                      : frame.quality_ok
                        ? 'Quality OK'
                        : 'Flagged'}
                  </span>
                  {frame.flags?.length > 0 && <span className="flags">{frame.flags.join(' · ')}</span>}
                </dd>
              </>
            ) : (
              (!frame.quality_ok || frame.measured?.saturated) && (
                <>
                  <dt>Quality</dt>
                  <dd>
                    <span className="status-item status-warn">
                      <StarIcon />
                      {!frame.quality_ok ? 'Flagged' : 'Saturated'}
                    </span>{' '}
                    <span className="status-meta">· details in Science mode</span>
                  </dd>
                </>
              )
            )}
          </dl>

          {manifest.frames.some((f) => f.predicted) && (
            <label className="tl-toggle">
              <input type="checkbox" checked={showExpected} onChange={(e) => setShowExpected(e.target.checked)} />
              Show catalogue position
            </label>
          )}
        </>
      )}

      {note && <p className="note">{note}</p>}

      {onSimulate && Number.isFinite(manifest.target?.pmra_mas_yr) && Number.isFinite(manifest.target?.pmdec_mas_yr) && (
        <button className="btn btn-link sim-btn" onClick={() => onSimulate(manifest.target, simYears(manifest.target), usedParallax(cardId ?? id, manifest.target, card))}>
          ▶ Watch it move: 2 years up close, then {simYears(manifest.target).toLocaleString('en')} years <span className="muted">· simulation</span>
        </button>
      )}

      {tabs.length > 0 && (
        <div className="info">
          <div className="seg small" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} className={activeTab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          {activeTab === 'motion' && <PositionChart frames={manifest.frames} currentMjd={frame.mjd} />}
          {activeTab === 'brightness' && <BrightnessChart frames={manifest.frames} currentMjd={frame.mjd} />}
          {activeTab === 'spectrum' && <SpectrumChart spectrum={spectrum} note={spectrumNote} />}
          {activeTab === 'parallax' && (
            <Parallax target={manifest.target} cardId={cardId ?? id} card={card} name={manifest.name} science={science} />
          )}
          {activeTab === 'upclose' && <UpClose cardId={cardId ?? id} card={card} name={manifest.name} />}
          {activeTab === 'about' && <ObjectCard card={card} description={description} science={science} />}
        </div>
      )}

      <div className="tl-foot">
        <p className="hint small">
          {manifest.frames.length} images · {first} → {last} · 1 square = 1 SPHEREx pixel ({g.pixel_scale_arcsec}″)
          <br />
          {manifest.data_credit}
        </p>
        <a className="btn btn-primary report" href={reportUrl(manifest, frame)} target="_blank" rel="noreferrer">
          Report a candidate ↗
        </a>
      </div>
    </div>
  )
}
