/*
 * SkyShift — time-lapse for any point the user clicks on the map.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * The user chooses the SPHEREx detector (D1-D6) and the field of view; both are kept in the URL.
 */
import { useEffect, useState } from 'react'
import TimeLapse from './TimeLapse.jsx'
import { StarIcon } from './Logo.jsx'
import { t } from './i18n.js'
import { BANDS, DEFAULT_SIZE_ARCMIN, SIZES_ARCMIN, loadSpot } from './spherexSpot.js'

// "Report a candidate" also works when no SPHEREx images could be loaded: it sends the position and
// the detector chosen, and the person describes what they saw. No personal data is collected.
function spotReportUrl(ra, dec, band, size, why) {
  const body = [
    `**Where:** RA ${ra.toFixed(5)}°, Dec ${dec.toFixed(5)}°`,
    `**SPHEREx detector chosen:** ${band}, field ${size}′ × ${size}′`,
    `**SPHEREx images in SkyShift:** ${why}`,
    `**Link:** ${window.location.href}`,
    '',
    '**What do you see?** (something that moves between dates, or changes brightness)',
    '',
    '**Evidence:** (which images or catalogues show it; did you check Gaia DR3, SIMBAD or another catalogue?)',
    '',
    '_Please do not include personal data. A candidate is not a discovery until it is checked._',
  ].join('\n')
  const q = new URLSearchParams({ title: `Candidate near RA ${ra.toFixed(3)}, Dec ${dec.toFixed(3)}`, body })
  return `https://github.com/teoaguiilar/skyshift/issues/new?${q.toString()}`
}

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
  const [attempt, setAttempt] = useState(0) // "Try again" bumps this to reload

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
  }, [ra, dec, band, size, attempt])

  const bandInfo = BANDS.find((b) => b.id === band)
  const pickers = (
    <div className="spot-pickers">
      <div className="spot-row">
        <span className="small-label">{t('Detector')}</span>
        <div className="seg small" role="tablist" aria-label="SPHEREx detector">
          {BANDS.map((b) => (
            <button key={b.id} className={band === b.id ? 'on' : ''} onClick={() => choose({ band: b.id })} title={b.range}>
              {b.id}
            </button>
          ))}
        </div>
      </div>
      <div className="spot-row">
        <span className="small-label">{t('Field')}</span>
        <div className="seg small" role="tablist" aria-label="Field of view">
          {SIZES_ARCMIN.map((s) => (
            <button key={s} className={size === s ? 'on' : ''} onClick={() => choose({ size: s })}>
              {s}′
            </button>
          ))}
        </div>
      </div>
      <p className="hint small">
        {t('{band}: about {range} (infrared) · field {size}′ × {size}′', { band, range: bandInfo.range, size })}
        {size === 8 ? t(' · larger fields take a little longer') : ''}
      </p>
    </div>
  )

  let body
  if (state === 'loading') {
    body = (
      <p className="hint">
        {progress.step === 'search'
          ? t('Searching the SPHEREx archive at this spot… this can take about 20 seconds.')
          : t('Downloading SPHEREx images… {done}/{total} (about half a minute)', { done: progress.done, total: progress.total })}
      </p>
    )
  } else if (state === 'empty' || state === 'error') {
    body = (
      <div className="spot-fail">
        {state === 'empty' ? (
          <p className="hint">{t('Not enough SPHEREx images at a similar wavelength here yet. Try another spot or detector.')}</p>
        ) : (
          <p className="status">
            {t(
              'The NASA SPHEREx archive (IRSA) did not answer: it is busy or down for a moment. This is not an error in your search.',
            )}
          </p>
        )}
        <div className="spot-fail-actions">
          {state === 'error' && (
            <button className="btn btn-link" onClick={() => setAttempt((a) => a + 1)}>
              {t('Try again')}
            </button>
          )}
          <a
            className="btn btn-primary report"
            href={spotReportUrl(ra, dec, band, size, state === 'empty' ? 'not enough images here yet' : 'the archive did not answer')}
            target="_blank"
            rel="noreferrer"
          >
            {t('Report a candidate ↗')}
          </a>
        </div>
      </div>
    )
  } else {
    body = (
      <>
        <TimeLapse id="spot" manifest={manifest} science={science} />
        <p className="hint">
          {t('{n} of {searched} SPHEREx images here were taken at a similar wavelength (±2 %).', {
            n: manifest.frames.length,
            searched: manifest.searched,
          })}{' '}
          {t('Something that shifts between dates is only a')}{' '}
          <span className="status-item status-candidate">
            <StarIcon />
            {t('candidate moving object')}
          </span>
          {t(', and something that changes brightness only a')}{' '}
          <span className="status-item status-candidate">
            <StarIcon />
            {t('candidate variable')}
          </span>
          {t(', until it is checked against other data.')}
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
