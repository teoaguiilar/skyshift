/*
 * SkyShift — time-lapse for any point the user clicks on the map.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * The user chooses the SPHEREx detector (D1-D6) and the field of view; both are kept in the URL.
 */
import { useEffect, useState } from 'react'
import TimeLapse from './TimeLapse.jsx'
import { StarIcon } from './Logo.jsx'
import { BANDS, DEFAULT_SIZE_ARCMIN, SIZES_ARCMIN, loadSpot } from './spherexSpot.js'

function readChoice() {
  const p = new URLSearchParams(window.location.search)
  const band = BANDS.some((b) => b.id === p.get('band')) ? p.get('band') : 'D2'
  const size = SIZES_ARCMIN.includes(Number(p.get('size'))) ? Number(p.get('size')) : DEFAULT_SIZE_ARCMIN
  return { band, size }
}
function writeChoice(band, size) {
  const p = new URLSearchParams(window.location.search)
  p.set('band', band)
  p.set('size', String(size))
  window.history.replaceState(null, '', `?${p.toString()}`)
}

export default function SpotLapse({ ra, dec, science = false }) {
  const [{ band, size }, setChoice] = useState(readChoice)
  const [manifest, setManifest] = useState(null)
  const [progress, setProgress] = useState({ step: 'search' })
  const [state, setState] = useState('loading')

  const choose = (next) => {
    const c = { band, size, ...next }
    setChoice(c)
    writeChoice(c.band, c.size)
  }

  useEffect(() => {
    const ctrl = new AbortController()
    setManifest(null)
    setState('loading')
    setProgress({ step: 'search' })
    loadSpot(ra, dec, { band, sizeArcmin: size, signal: ctrl.signal, onProgress: (p) => !ctrl.signal.aborted && setProgress(p) })
      .then((m) => {
        if (ctrl.signal.aborted || !m) return
        if (m.empty) setState('empty')
        else {
          setManifest(m)
          setState('ready')
        }
      })
      .catch(() => !ctrl.signal.aborted && setState('error'))
    return () => ctrl.abort()
  }, [ra, dec, band, size])

  const bandInfo = BANDS.find((b) => b.id === band)
  const pickers = (
    <div className="spot-pickers">
      <div className="spot-row">
        <span className="small-label">Detector</span>
        <div className="seg small" role="tablist" aria-label="SPHEREx detector">
          {BANDS.map((b) => (
            <button key={b.id} className={band === b.id ? 'on' : ''} onClick={() => choose({ band: b.id })} title={b.range}>
              {b.id}
            </button>
          ))}
        </div>
      </div>
      <div className="spot-row">
        <span className="small-label">Field</span>
        <div className="seg small" role="tablist" aria-label="Field of view">
          {SIZES_ARCMIN.map((s) => (
            <button key={s} className={size === s ? 'on' : ''} onClick={() => choose({ size: s })}>
              {s}′
            </button>
          ))}
        </div>
      </div>
      <p className="hint small">
        {band}: about {bandInfo.range} (infrared) · field {size}′ × {size}′
        {size === 8 ? ' · larger fields take a little longer' : ''}
      </p>
    </div>
  )

  let body
  if (state === 'loading') {
    body = (
      <p className="hint">
        {progress.step === 'search'
          ? 'Searching the SPHEREx archive at this spot… this can take about 20 seconds.'
          : `Downloading SPHEREx images… ${progress.done}/${progress.total} (about half a minute)`}
      </p>
    )
  } else if (state === 'empty') {
    body = <p className="hint">Not enough SPHEREx images at a similar wavelength here yet. Try another spot or detector.</p>
  } else if (state === 'error') {
    body = <p className="status">The SPHEREx archive did not answer. Please try again in a moment.</p>
  } else {
    body = (
      <>
        <TimeLapse id="spot" manifest={manifest} science={science} />
        <p className="hint">
          {manifest.frames.length} of {manifest.searched} SPHEREx images here were taken at a similar wavelength (±2 %).
          Something that shifts between dates is only a{' '}
          <span className="status-item status-candidate">
            <StarIcon />
            candidate moving object
          </span>
          , and something that changes brightness only a{' '}
          <span className="status-item status-candidate">
            <StarIcon />
            candidate variable
          </span>
          , until it is checked against other data.
        </p>
      </>
    )
  }

  return (
    <>
      {pickers}
      {body}
    </>
  )
}
