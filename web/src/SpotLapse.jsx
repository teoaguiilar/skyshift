/*
 * SkyShift — time-lapse for any point the user clicks on the map.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 */
import { useEffect, useState } from 'react'
import TimeLapse from './TimeLapse.jsx'
import { loadSpot } from './spherexSpot.js'

export default function SpotLapse({ ra, dec }) {
  const [manifest, setManifest] = useState(null)
  const [progress, setProgress] = useState({ step: 'search' })
  const [state, setState] = useState('loading')

  useEffect(() => {
    const ctrl = new AbortController()
    setManifest(null)
    setState('loading')
    setProgress({ step: 'search' })
    loadSpot(ra, dec, { signal: ctrl.signal, onProgress: (p) => !ctrl.signal.aborted && setProgress(p) })
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
  }, [ra, dec])

  if (state === 'loading') {
    return (
      <p className="hint">
        {progress.step === 'search'
          ? 'Searching the SPHEREx archive at this spot…'
          : `Downloading SPHEREx images… ${progress.done}/${progress.total}`}
      </p>
    )
  }
  if (state === 'empty') return <p className="hint">Not enough SPHEREx images at a similar wavelength here yet. Try another spot.</p>
  if (state === 'error') return <p className="status">The SPHEREx archive did not answer. Please try again in a moment.</p>

  return (
    <>
      <TimeLapse id="spot" manifest={manifest} />
      <p className="hint">
        {manifest.frames.length} of {manifest.searched} SPHEREx images here were taken at a similar wavelength (±2 %).
        Anything that moves or blinks is only a <strong>candidate</strong> until it is checked.
      </p>
    </>
  )
}
