/*
 * SkyShift — SPHEREx time-lapse player for one object.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Reads data/<id>/manifest.json + PNG frames produced by pipeline/fetch_object.py (Teo).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { BrightnessChart, PositionChart } from './Charts.jsx'

// Data lives in the public GitHub repo, so new frames appear without redeploying the web.
const DATA_BASE = 'https://raw.githubusercontent.com/teoaguiilar/skyshift/main/data'
const VIEW_SIZE = 340 // px on screen

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

export default function TimeLapse({ id, manifest: given, kind }) {
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(false)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [showExpected, setShowExpected] = useState(false)
  const [difference, setDifference] = useState(null) // data/<id>/difference.json, if the pipeline made one
  const [mode, setMode] = useState('frames') // 'frames' | 'difference'

  useEffect(() => {
    setDifference(null)
    setMode('frames')
    if (given || !id) return
    fetch(`${DATA_BASE}/${id}/difference.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDifference)
      .catch(() => setDifference(null))
  }, [id, given])
  const timer = useRef(null)

  useEffect(() => {
    setManifest(null)
    setError(false)
    setIndex(0)
    setPlaying(true)
    if (given) {
      setManifest({ ...given, frames: [...given.frames].sort((a, b) => a.mjd - b.mjd) })
      return
    }
    fetch(`${DATA_BASE}/${id}/manifest.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((m) => {
        m.frames.sort((a, b) => a.mjd - b.mjd)
        // Preload every frame so the animation does not flicker.
        m.frames.forEach((f) => {
          const img = new Image()
          img.src = srcOf(f, id)
        })
        setManifest(m)
      })
      .catch(() => setError(true))
  }, [id, given])

  useEffect(() => {
    clearInterval(timer.current)
    if (playing && manifest && manifest.frames.length > 1) {
      timer.current = setInterval(() => setIndex((i) => (i + 1) % manifest.frames.length), 700)
    }
    return () => clearInterval(timer.current)
  }, [playing, manifest])

  const frame = manifest?.frames[index]
  const expected = useMemo(() => {
    if (!frame?.predicted || !manifest) return null
    return skyToPixel(frame.predicted.ra_deg, frame.predicted.dec_deg, manifest.grid)
  }, [frame, manifest])

  if (error) return <p className="hint">SPHEREx time-lapse for this object is coming soon.</p>
  if (!manifest) return <p className="hint">Loading SPHEREx images…</p>

  const first = manifest.frames[0].date
  const last = manifest.frames[manifest.frames.length - 1].date

  return (
    <div className="timelapse">
      <div className="tl-head">
        <span>SPHEREx time-lapse{manifest.stacked ? ' · stacked visits' : ''}</span>
        <span className="tl-band">
          {manifest.band} · {manifest.wavelength_um.toFixed(2)} µm
        </span>
      </div>

      {difference && (
        <div className="tl-modes" role="tablist">
          <button className={mode === 'frames' ? 'on' : ''} onClick={() => setMode('frames')}>
            Frames
          </button>
          <button className={mode === 'difference' ? 'on' : ''} onClick={() => setMode('difference')}>
            Difference
          </button>
        </div>
      )}

      {mode === 'difference' && difference ? (
        <>
          <div className="tl-view" style={{ width: VIEW_SIZE, height: VIEW_SIZE }}>
            <img
              src={`${DATA_BASE}/${id}/${difference.file}`}
              alt={`${manifest.name}: last SPHEREx visit minus the first one`}
            />
            <svg
              viewBox={`0 0 ${manifest.grid.width * manifest.grid.png_upscale} ${manifest.grid.height * manifest.grid.png_upscale}`}
              className="tl-overlay"
            >
              {difference.visits.map((v) => {
                const u = manifest.grid.png_upscale
                const cx = (v.predicted_pixel.x + 0.5) * u
                const cy = (manifest.grid.height - (v.predicted_pixel.y + 0.5)) * u
                return <circle key={v.visit} cx={cx} cy={cy} r="24" className={v.visit === 'first' ? 'diff-first' : 'diff-last'} />
              })}
            </svg>
            <span className="tl-compass">N ↑ · E ←</span>
          </div>
          <p className="hint">
            <span className="diff-key first" /> {difference.visits[0].date} (first visit) →{' '}
            <span className="diff-key last" /> {difference.visits[difference.visits.length - 1].date} (last visit). Circles: catalogue position.
          </p>
          <p className="hint">{difference.how_to_read}</p>
        </>
      ) : (
      <div className="tl-view" style={{ width: VIEW_SIZE, height: VIEW_SIZE }}>
          <img src={srcOf(frame, id)} alt={`${manifest.name}, SPHEREx image of ${frame.date}`} />
          {showExpected && expected && (
            <svg viewBox={`0 0 ${expected.w} ${expected.h}`} className="tl-overlay">
              <circle cx={expected.x} cy={expected.y} r="22" />
              <line x1={expected.x - 40} y1={expected.y} x2={expected.x - 26} y2={expected.y} />
              <line x1={expected.x + 26} y1={expected.y} x2={expected.x + 40} y2={expected.y} />
              <line x1={expected.x} y1={expected.y - 40} x2={expected.x} y2={expected.y - 26} />
              <line x1={expected.x} y1={expected.y + 26} x2={expected.x} y2={expected.y + 40} />
            </svg>
          )}
          <span className="tl-compass">N ↑ · E ←</span>
        </div>
      )}

      {mode === 'frames' && (
        <>
      <div className="tl-controls">
        <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
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
          {frame.date} <span className="muted">({index + 1}/{manifest.frames.length})</span>
        </dd>
        <dt>λ</dt>
        <dd>
          {frame.wavelength_range_um
            ? `${frame.wavelength_range_um[0].toFixed(2)}–${frame.wavelength_range_um[1].toFixed(2)} µm`
            : `${frame.wavelength_um.toFixed(3)} µm`}
        </dd>
        {frame.stacked_images && (
          <>
            <dt>Stack</dt>
            <dd>
              {frame.stacked_images} images · S/N {frame.snr?.toFixed(1)} ·{' '}
              <span className={frame.detected ? '' : 'warn'}>{frame.detected ? 'detected' : 'not detected'}</span>
            </dd>
          </>
        )}
        <dt>Quality</dt>
        <dd className={frame.quality_ok ? '' : 'warn'}>
          {frame.quality_ok ? 'OK' : 'Flagged'}
          {frame.measured?.saturated ? ' · saturated' : ''}
          {frame.flags?.length > 0 && <span className="flags">{frame.flags.join(' · ')}</span>}
        </dd>
      </dl>
        </>
      )}

      {manifest.frames.some((f) => f.predicted) && (
      <label className="tl-toggle">
        <input type="checkbox" checked={showExpected} onChange={(e) => setShowExpected(e.target.checked)} />
        Show expected position (catalogue proper motion)
      </label>
      )}

      {kind === 'moves' && <PositionChart frames={manifest.frames} currentMjd={frame.mjd} />}
      {kind === 'varies' && <BrightnessChart frames={manifest.frames} currentMjd={frame.mjd} />}

      <p className="hint">
        {manifest.frames.length} images from {first} to {last}. Each square is one SPHEREx pixel (6.15″).
      </p>
      <p className="credit">{manifest.data_credit}</p>
    </div>
  )
}
