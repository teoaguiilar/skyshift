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
import Bands from './Bands.jsx'
import { BrightnessChart, PositionChart, FilteredSpectrum, SpectrumChart, byVisit, hasBrightness, hasPosition } from './Charts.jsx'
import ObjectCard from './ObjectCard.jsx'
import Frame, { FrameOverlay } from './Frame.jsx'
import UpClose, { hasUpClose } from './UpClose.jsx'
import Parallax, { usedParallax } from './Parallax.jsx'
import { getLang, t as tr } from './i18n.js'
import ReportForm from './ReportForm.jsx'
import { IconEye, IconFlag, IconLink, IconPlay } from './Icons.jsx'

// "What to look for": one sentence built from the data, so a newcomer knows what to watch.
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
function whatToLook(manifest, kind) {
  const tg = manifest.target
  if (kind === 'moves' && Number.isFinite(tg?.pmra_mas_yr) && Number.isFinite(tg?.pmdec_mas_yr)) {
    const pm = Math.hypot(tg.pmra_mas_yr, tg.pmdec_mas_yr) / 1000
    const ang = (Math.atan2(tg.pmra_mas_yr, tg.pmdec_mas_yr) * 180) / Math.PI // 0 = north, 90 = east
    const dir = DIRS[Math.round((((ang % 360) + 360) % 360) / 45) % 8]
    return tr('It moves {pm}″ a year towards the {dir} (catalogue value). Watch the dot shift between the first and the latest visit.', {
      pm: pm.toFixed(pm < 1 ? 2 : 1),
      dir: tr(dir),
    })
  }
  if (kind === 'varies') {
    const usable = manifest.frames.filter((f) => f.measured?.flux_rel != null && !f.measured?.saturated)
    if (usable.length < 3) return tr('It is too bright for SPHEREx: it saturates the images, so its brightness changes cannot be measured here.')
    const visits = byVisit(usable.map((f) => ({ t: f.mjd, y: f.measured.flux_rel })))
    const ys = visits.map((v) => v.y).filter((y) => y > 0)
    if (ys.length >= 2) {
      const ratio = Math.max(...ys) / Math.min(...ys)
      return tr('Between visits its SPHEREx brightness changed by about ×{ratio}. Watch it get brighter and fainter.', { ratio: ratio.toFixed(1) })
    }
  }
  return null
}
import { StarIcon } from './Logo.jsx'

const REPO_RAW = 'https://raw.githubusercontent.com/teoaguiilar/skyshift/main'
const DATA_BASE = `${REPO_RAW}/data`
const CARDS_BASE = `${REPO_RAW}/science/cards`
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

// Copies the page link (it already holds the object, view, mode and language).
export function ShareButton() {
  const [done, setDone] = useState(false)
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      window.prompt(tr('Copy this link'), window.location.href)
    }
  }
  return (
    <button className="btn action" onClick={share}>
      <IconLink />
      {done ? tr('Link copied') : tr('Share link')}
    </button>
  )
}

export default function TimeLapse({ id, manifest: given, kind, cardId, note, hideSpectrum, spectrumNote, science = false, onSimulate, hideReport = false, objectName, onFrameChange, requestMjd }) {
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(false)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [showExpected, setShowExpected] = useState(false)
  const [difference, setDifference] = useState(null)
  const [falseColor, setFalseColor] = useState(null)
  const [spectrum, setSpectrum] = useState(null)
  const [spectrumFiltered, setSpectrumFiltered] = useState(null)
  const [bands, setBands] = useState(null)
  const [card, setCard] = useState(null)
  const [reporting, setReporting] = useState(false)
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
    setSpectrumFiltered(null)
    setBands(null)
    setCard(null)
    setDescriptions(null)
    setMode('frames')
    setTab(null)
    if (given || !id) return
    const c = cardId ?? id
    getJson(`${DATA_BASE}/${id}/difference.json`).then(setDifference)
    // Bands tab (Science): only if the file exists and looks right.
    getJson(`${DATA_BASE}/${id}/bands.json`).then((b) => setBands(b?.grid?.width && b.visits?.length ? b : null))
    getJson(`${DATA_BASE}/${id}/false_color.json`).then(setFalseColor)
    if (!hideSpectrum) {
      getJson(`${DATA_BASE}/${c}/spectrum.json`).then(setSpectrum)
      getJson(`${DATA_BASE}/${c}/spectrum_filtered.json`).then(setSpectrumFiltered)
    }
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

  // Sky date control (corner of the map): tell it which image is on screen, and follow it when it picks one.
  useEffect(() => {
    if (!onFrameChange || !manifest || !frame) return
    onFrameChange({
      mjd: frame.mjd,
      dates: manifest.frames.map((f) => ({ mjd: f.mjd, date: f.date })),
      target: given ? null : manifest.target,
      kind,
    })
  }, [frame, manifest]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onFrameChange?.(null), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!requestMjd || !manifest) return
    const i = manifest.frames.findIndex((f) => f.mjd === requestMjd.mjd)
    if (i >= 0) {
      setPlaying(false)
      setMode('frames')
      setIndex(i)
    }
  }, [requestMjd]) // eslint-disable-line react-hooks/exhaustive-deps
  const expected = useMemo(() => {
    if (!frame?.predicted || !manifest) return null
    return skyToPixel(frame.predicted.ra_deg, frame.predicted.dec_deg, manifest.grid)
  }, [frame, manifest])

  if (error) return <p className="hint">{tr('SPHEREx time-lapse for this object is coming soon.')}</p>
  if (!manifest) return <p className="hint">{tr('Loading SPHEREx images…')}</p>

  const first = manifest.frames[0].date
  const last = manifest.frames[manifest.frames.length - 1].date
  const g = manifest.grid

  // Info tabs: only the ones with real data behind them.
  const tabs = []
  if (science && kind === 'moves' && hasPosition(manifest.frames)) tabs.push({ key: 'motion', label: tr('Motion') })
  if (science && kind === 'varies' && hasBrightness(manifest.frames)) tabs.push({ key: 'brightness', label: tr('Brightness') })
  if (science && spectrum?.binned?.length > 2) tabs.push({ key: 'spectrum', label: tr('Spectrum') })
  if (science && bands) tabs.push({ key: 'bands', label: tr('Bands') })
  // Description for the current mode (falls back to the other one if only one is written).
  const description = descriptions ? (science ? descriptions.science || descriptions.explore : descriptions.explore || descriptions.science) : null
  if (!given && Number.isFinite(manifest.target?.parallax_mas)) tabs.push({ key: 'parallax', label: tr('Parallax') })
  if (!given && hasUpClose(cardId ?? id)) tabs.push({ key: 'upclose', label: tr('Up close') })
  if (card || description) tabs.push({ key: 'about', label: tr('About') })
  const activeTab = tabs.find((t) => t.key === tab)?.key ?? tabs[0]?.key

  return (
    <div className="timelapse">
      <div className="tl-head">
        <span className="small-label">
          {tr('SPHEREx time-lapse')}
          {manifest.stacked ? tr(', stacked visits') : ''}
        </span>
        {science && (
          <span className="status-meta">
            {manifest.band} · {Number(manifest.wavelength_um).toFixed(2)} µm
          </span>
        )}
      </div>

      {!given && whatToLook(manifest, kind) && (
        <p className="look">
          <IconEye />
          <span>
            <strong>{tr('What to look for')}: </strong>
            {whatToLook(manifest, kind)}
          </span>
        </p>
      )}

      <div className="actions">
        {onSimulate && Number.isFinite(manifest.target?.pmra_mas_yr) && Number.isFinite(manifest.target?.pmdec_mas_yr) && (
          <button
            className={`btn action${kind === 'moves' ? ' btn-primary' : ''}`}
            onClick={() => onSimulate(manifest.target, simYears(manifest.target), usedParallax(cardId ?? id, manifest.target, card))}
            title={tr('▶ Watch it move: 2 years up close, then {years} years', { years: simYears(manifest.target).toLocaleString(getLang()) })}
          >
            <IconPlay />
            {tr('Watch it move')}
          </button>
        )}
        {!hideReport && (
          <button className="btn action" onClick={() => setReporting(true)}>
            <IconFlag />
            {tr('Report a candidate')}
          </button>
        )}
        {!hideReport && <ShareButton />}
      </div>

      {manifest.frames.length > 1 && (
        <div className="first-last">
          <div className="first-last-row">
            <Frame src={srcOf(manifest.frames[0], id)} grid={g} frame={manifest.frames[0]} label={tr('First visit')} size={148} />
            <span className="first-last-arrow" aria-hidden="true">
              →
            </span>
            <Frame
              src={srcOf(manifest.frames[manifest.frames.length - 1], id)}
              grid={g}
              frame={manifest.frames[manifest.frames.length - 1]}
              label={tr('Latest visit')}
              size={148}
            />
          </div>
          <p className="small-label">
            {tr('Real NASA SPHEREx images. North is up; each square is one {px}″ pixel.', { px: g.pixel_scale_arcsec })}
            {manifest.frames.some((f) => f.measured && Number.isFinite(f.measured.ra_deg))
              ? tr(' The cyan marks show where SkyShift measured the object.')
              : ''}
          </p>
        </div>
      )}

      {(difference || (science && falseColor)) && (
        <div className="seg" role="tablist">
          <button className={mode === 'frames' ? 'on' : ''} onClick={() => setMode('frames')}>
            {tr('Frames')}
          </button>
          {difference && (
            <button className={mode === 'difference' ? 'on' : ''} onClick={() => setMode('difference')}>
              {tr('Difference')}
            </button>
          )}
          {science && falseColor && (
            <button className={mode === 'false' ? 'on' : ''} onClick={() => setMode('false')}>
              {tr('False colour')}
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
                {(c => c[0].toUpperCase() + c.slice(1))(tr(l.colour))} = {l.wavelengths_used_um[0].toFixed(2)}–
                {l.wavelengths_used_um[1].toFixed(2)} µm ({l.detector}) <span className="muted">· {l.images} {tr('images')}</span>
              </li>
            ))}
          </ul>
          <p className="hint">
            {tr('One visit: {from} → {to}.', { from: falseColor.visit.from, to: falseColor.visit.to })} {falseColor.note}
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
            {difference.visits[difference.visits.length - 1].date}. {difference.how_to_read} {tr('Circles: catalogue position.')}
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
            <button className="btn tl-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? tr('Pause the time-lapse') : tr('Play the time-lapse')}>
              {playing ? tr('Pause') : tr('Play')}
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
              aria-label={tr('Observation date')}
            />
          </div>

          <dl className="coords tl-meta">
            <dt>{tr('Date')}</dt>
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
                <dt>{tr('Stack')}</dt>
                <dd>
                  {frame.stacked_images} images · S/N {frame.snr?.toFixed(1)} ·{' '}
                  <span className={frame.detected ? '' : 'warn'}>{frame.detected ? tr('detected') : tr('not detected')}</span>
                </dd>
              </>
            )}
            {frame.stacked_images ? (
              // Stacked visit (WISE 0855): say how many of the summed images had flags.
              <>
                <dt>{tr('Quality')}</dt>
                <dd>
                  <span className={`status-item ${frame.quality_ok ? 'status-ok' : 'status-warn'}`}>
                    <StarIcon />
                    {!frame.quality_ok
                      ? tr('Flagged · more than half of the images had flags')
                      : frame.flagged_images > 0
                        ? tr('Quality OK · {k} of {n} images had flags ({flags}); the median of the visit is barely affected', {
                            k: frame.flagged_images,
                            n: frame.stacked_images,
                            flags: (frame.flags ?? []).filter((f) => f !== 'SOURCE').join(', '),
                          })
                        : tr('Quality OK · none of the {n} images had bad-pixel flags', { n: frame.stacked_images })}
                  </span>
                </dd>
              </>
            ) : science ? (
              <>
                <dt>{tr('Quality')}</dt>
                <dd>
                  <span className={`status-item ${frame.quality_ok && !frame.measured?.saturated ? 'status-ok' : 'status-warn'}`}>
                    <StarIcon />
                    {frame.measured?.saturated
                      ? `${tr('Saturated')}${frame.quality_ok ? tr(' (no bad-pixel flags)') : ` · ${tr('Flagged')}`}`
                      : frame.quality_ok
                        ? tr('Quality OK')
                        : tr('Flagged')}
                  </span>
                  {frame.flags?.length > 0 && <span className="flags">{frame.flags.join(' · ')}</span>}
                </dd>
              </>
            ) : (
              (!frame.quality_ok || frame.measured?.saturated) && (
                <>
                  <dt>{tr('Quality')}</dt>
                  <dd>
                    <span className="status-item status-warn">
                      <StarIcon />
                      {!frame.quality_ok ? tr('Flagged') : tr('Saturated')}
                    </span>{' '}
                    <span className="status-meta">{tr('· details in Science mode')}</span>
                  </dd>
                </>
              )
            )}
          </dl>

          {manifest.frames.some((f) => f.predicted) && (
            <label className="tl-toggle">
              <input type="checkbox" checked={showExpected} onChange={(e) => setShowExpected(e.target.checked)} />
              {tr('Show catalogue position')}
            </label>
          )}
        </>
      )}

      {note && <p className="note">{note}</p>}


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
          {activeTab === 'spectrum' && <FilteredSpectrum spectrum={spectrum} filtered={spectrumFiltered} note={spectrumNote} />}
          {activeTab === 'bands' && <Bands key={id} bands={bands} />}
          {activeTab === 'parallax' && (
            <Parallax target={manifest.target} cardId={cardId ?? id} card={card} name={objectName ?? manifest.name} science={science} />
          )}
          {activeTab === 'upclose' && <UpClose cardId={cardId ?? id} card={card} name={objectName ?? manifest.name} />}
          {activeTab === 'about' && <ObjectCard card={card} description={description} science={science} />}
        </div>
      )}

      <div className="tl-foot">
        <p className="hint small">
          {tr('{n} images · {first} → {last} · 1 square = 1 SPHEREx pixel ({px}″)', {
            n: manifest.frames.length,
            first,
            last,
            px: g.pixel_scale_arcsec,
          })}
          <br />
          {manifest.data_credit}
        </p>
        {reporting && (
          <ReportForm
            onClose={() => setReporting(false)}
            context={{
              ra: g.center_ra_deg,
              dec: g.center_dec_deg,
              band: manifest.band,
              wavelength_um: manifest.wavelength_um,
              dates: [first, last],
              imageDate: frame.date,
              objectName: objectName ?? manifest.name,
              kind,
            }}
          />
        )}
      </div>
    </div>
  )
}
