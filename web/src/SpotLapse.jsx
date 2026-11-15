/*
 * SkyShift — time-lapse for any point the user clicks on the map.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * The user chooses the SPHEREx detector (D1-D6) and the field of view; both are kept in the URL.
 */
import { useEffect, useState } from 'react'
import TimeLapse, { ShareButton } from './TimeLapse.jsx'
import { StarIcon } from './Logo.jsx'
import { t } from './i18n.js'
import ReportForm from './ReportForm.jsx'
import { SpectrumChart } from './Charts.jsx'
import { IconFlag, IconWave } from './Icons.jsx'
import { loadTargets, tourObjectAt } from './tourMatch.js'

const REPO_DATA = 'https://raw.githubusercontent.com/teoaguiilar/skyshift/main/data'

// "Spectrum (on the fly)": asks our /api/spectrum function (by Teo) to measure this point in every
// SPHEREx image of one visit, all six detectors (0.75-5 µm). It can take up to a minute.
// Shown when NASA's IRSA services do not answer (they are outside SkyShift).
const IRSA_DOWN_TEXT =
  "Temporarily unavailable: this feature searches SPHEREx images live on NASA's IRSA archive, which is not answering right now. It is not a SkyShift problem: it will work again as soon as NASA's service is back. Meanwhile, the guided tour works normally, because its data is saved by the team."

// tour = [{ id, spectrum }]: guided-tour objects and the folder of their precomputed spectrum.
function OnTheFlySpectrum({ ra, dec, tour = [] }) {
  const [visit, setVisit] = useState('latest')
  const [state, setState] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setState('idle')
    setResult(null)
  }, [ra, dec])

  const run = async (which) => {
    setVisit(which)
    setState('loading')
    setResult(null)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 75000)
    try {
      // On a guided-tour object (less than 1′ away): its spectrum already computed by the team from the
      // same SPHEREx images, so the button works even when IRSA is down.
      if (tour.length) {
        const targets = await loadTargets(tour.map((o) => o.id), REPO_DATA)
        const hit = tourObjectAt(ra, dec, targets)
        const folder = hit && tour.find((o) => o.id === hit.id)?.spectrum
        const saved = folder && (await fetch(`${REPO_DATA}/${folder}/spectrum.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
        if (saved?.binned?.length > 2) {
          setResult({ ...saved, precomputed: true })
          setState('done')
          return
        }
      }
      const q = `ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}${which === 'first' ? '&visit=first' : ''}`
      const r = await fetch(`/api/spectrum?${q}`, { signal: ctrl.signal })
      if ([502, 503, 504].includes(r.status)) throw new Error('IRSA_DOWN')
      const data = await r.json().catch(() => null)
      if (!r.ok || !data) throw new Error(data?.error || `HTTP ${r.status}`)
      setResult(data)
      setState('done')
    } catch (e) {
      // IRSA busy or down (502/503/504) or too slow: a friendly message, not a raw error.
      setError(
        e.name === 'AbortError' || e.message === 'IRSA_DOWN' || /IRSA|took too long|502|503|504/.test(e.message)
          ? t(IRSA_DOWN_TEXT)
          : e.message,
      )
      setState('error')
    } finally {
      clearTimeout(timer)
    }
  }

  return (
    <div className="otf">
      <div className="otf-actions">
        <button className="btn action" onClick={() => run(visit)} disabled={state === 'loading'}>
          <IconWave />
          {t('Spectrum (on the fly)')}
        </button>
        <div className="seg small" role="tablist" aria-label={t('Visit')}>
          {['latest', 'first'].map((v) => (
            <button key={v} className={visit === v ? 'on' : ''} onClick={() => (state === 'idle' ? setVisit(v) : run(v))} disabled={state === 'loading'}>
              {v === 'latest' ? t('Latest visit') : t('First visit')}
            </button>
          ))}
        </div>
      </div>
      {state === 'loading' && <p className="hint">{t('Measuring every SPHEREx image of this visit, all six detectors… up to 1 min.')}</p>}
      {state === 'error' && (
        <div className="spot-fail">
          <p className="service-down">{error}</p>
          <div className="spot-fail-actions">
            <button className="btn btn-link" onClick={() => run(visit)}>
              {t('Try again')}
            </button>
          </div>
        </div>
      )}
      {state === 'done' && result && (
        <>
          {result.count === 0 ? (
            <p className="hint">{result.note ?? t('SPHEREx has no images of this point yet.')}</p>
          ) : (
            <>
              <SpectrumChart spectrum={result} />
              {result.precomputed ? (
                <p className="small-label">
                  {result.name} · {t('Precomputed from the same SPHEREx images')} · {t('{n} measurements', { n: result.points?.length ?? 0 })}
                </p>
              ) : (
              <p className="small-label">
                {t('Visit {from} → {to} · {n} measurements · {skipped} images skipped · {s} s', {
                  from: result.visit?.from,
                  to: result.visit?.to,
                  n: result.count,
                  skipped: result.skipped ?? 0,
                  s: result.seconds,
                })}
              </p>
              )}
              {result.partial && <p className="note">{t('partial: IRSA was slow, so not every image was measured.')}</p>}
              {!result.precomputed && <p className="small-label">{t('Measured on the fly: no aperture correction, so absolute values are approximate; the shape is what matters.')}</p>}
            </>
          )}
        </>
      )}
    </div>
  )
}
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

export default function SpotLapse({ ra, dec, science = false, onFrameChange, requestMjd, tour }) {
  const [{ band, size }, setChoice] = useState(readChoice)
  const [manifest, setManifest] = useState(null)
  const [progress, setProgress] = useState({ step: 'search' })
  const [state, setState] = useState('loading')
  const [attempt, setAttempt] = useState(0) // "Try again" bumps this to reload
  const [reporting, setReporting] = useState(false)

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
          <p className="service-down">{t(IRSA_DOWN_TEXT)}</p>
        )}
        <div className="spot-fail-actions">
          {state === 'error' && (
            <button className="btn btn-link" onClick={() => setAttempt((a) => a + 1)}>
              {t('Try again')}
            </button>
          )}
        </div>
      </div>
    )
  } else {
    body = (
      <>
        <TimeLapse id="spot" manifest={manifest} science={science} hideReport onFrameChange={onFrameChange} requestMjd={requestMjd} />
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
      {/* Available at once, without waiting for the SPHEREx images (they can take a minute). */}
      <div className="actions">
        <button className="btn btn-primary action" onClick={() => setReporting(true)}>
          <IconFlag />
          {t('Report a candidate')}
        </button>
        <ShareButton />
      </div>
      <OnTheFlySpectrum ra={ra} dec={dec} tour={tour} />
      {reporting && (
        <ReportForm
          onClose={() => setReporting(false)}
          context={{
            ra,
            dec,
            band,
            wavelength_um: manifest?.wavelength_um,
            dates: manifest ? [manifest.frames[0].date, manifest.frames[manifest.frames.length - 1].date] : null,
          }}
        />
      )}
      {body}
    </>
  )
}
