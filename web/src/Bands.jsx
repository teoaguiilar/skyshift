/*
 * SkyShift — "Bands" tab (Science mode): the six SPHEREx detector arrays (D1 shortest to D6 longest
 * infrared wavelengths), summed in the browser to gain signal, visit by visit.
 * Idea of Benjamín (SkyShift Murcia), following a suggestion of the challenge; data by Teo
 * (data/<id>/bands.json, NASA SPHEREx via IRSA).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 *
 * bands.json: grid {width, height, pixel_scale_arcsec}; visits[] {visit, from, to, mjd, predicted {x, y},
 * bands {D1..D6: {images, wavelength_um [min, max], data, position {x, y, saturated} | null}}};
 * motion {D1..D6: {from_visit, to_visit, measured_arcsec {east, north}, predicted_arcsec {east, north}} | null};
 * how_to_read. data = base64 Float32 little-endian, width × height, rows from the BOTTOM, NaN = no data,
 * MJy/sr with the background removed (so detectors can be added directly).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { t } from './i18n.js'

const DETS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']
const VIEW = 340 // px on screen, like the time-lapse frames
const CORE_PX = 4 // NaN closer than this to the centre = saturated core (white); farther = no data (black)

function decode(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const out = new Float32Array(bytes.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true)
  return out
}

const percentile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))]
const fmt = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}″`)
const range = (w) => (w ? (w[0] === w[1] ? `${w[0].toFixed(2)} µm` : `${w[0].toFixed(2)}–${w[1].toFixed(2)} µm`) : '')

export default function Bands({ bands }) {
  const { width: W, height: H } = bands.grid
  const visits = bands.visits

  // Decoded images per visit and detector (once per file).
  const images = useMemo(
    () =>
      visits.map((v) => {
        const out = {}
        for (const d of DETS) {
          const b = v.bands?.[d]
          if (b?.data) {
            try {
              out[d] = decode(b.data)
            } catch {
              /* corrupt entry: treated as missing */
            }
          }
        }
        return out
      }),
    [visits],
  )
  const available = useMemo(() => DETS.filter((d) => images.some((im) => im[d])), [images])
  // Wavelength range of each detector over all visits.
  const waves = useMemo(() => {
    const w = {}
    for (const v of visits)
      for (const d of DETS) {
        const r = v.bands?.[d]?.wavelength_um
        if (r) w[d] = w[d] ? [Math.min(w[d][0], r[0]), Math.max(w[d][1], r[1])] : [...r]
      }
    return w
  }, [visits])

  const [on, setOn] = useState(() => new Set(available))
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const canvasRef = useRef(null)
  const selected = DETS.filter((d) => on.has(d))

  // Sum of the selected detectors for each visit (NaN where none of them has data).
  const sums = useMemo(
    () =>
      images.map((im) => {
        const parts = selected.map((d) => im[d]).filter(Boolean)
        if (!parts.length) return null
        const out = new Float32Array(W * H)
        for (let i = 0; i < out.length; i++) {
          let s = 0
          let n = 0
          for (const p of parts) {
            const v = p[i]
            if (Number.isFinite(v)) {
              s += v
              n++
            }
          }
          out[i] = n ? s : NaN
        }
        return out
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images, selected.join(','), W, H],
  )

  // One asinh stretch for all visits of this selection, so they can be compared.
  const stretch = useMemo(() => {
    const vals = []
    for (const s of sums) if (s) for (const v of s) if (Number.isFinite(v)) vals.push(v)
    if (!vals.length) return null
    vals.sort((a, b) => a - b)
    const lo = percentile(vals, 0.01)
    const hi = percentile(vals, 0.995)
    const span = hi - lo || 1
    const soft = span * 0.05
    const top = Math.asinh(span / soft)
    return (v) => Math.min(1, Math.max(0, Math.asinh((v - lo) / soft) / top))
  }, [sums])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setIndex((i) => (i + 1) % visits.length), 1100)
    return () => clearInterval(id)
  }, [playing, visits.length])

  const sum = sums[index]
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(W, H)
    const cx = (W - 1) / 2
    const cy = (H - 1) / 2
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = sum ? sum[y * W + x] : NaN
        let g
        if (Number.isFinite(v) && stretch) g = Math.round(stretch(v) * 255)
        else g = sum && Math.hypot(x - cx, y - cy) < CORE_PX ? 255 : 0
        const o = ((H - 1 - y) * W + x) * 4 // rows come from the bottom: flip them
        img.data[o] = img.data[o + 1] = img.data[o + 2] = g
        img.data[o + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  }, [sum, stretch, W, H])

  const visit = visits[index]
  const toggle = (d) =>
    setOn((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  // SVG overlay in pixel units; pixel i is centred on i + 0.5, rows counted from the bottom.
  const sx = (x) => x + 0.5
  const sy = (y) => H - 1 - y + 0.5
  const one = selected.length === 1 ? visit.bands?.[selected[0]]?.position : null

  return (
    <div className="bands">
      <fieldset className="bands-dets">
        <legend className="small-label">{t('Detectors to add up')}</legend>
        {DETS.map((d) => {
          const usable = available.includes(d)
          return (
            <label key={d} className={usable ? '' : 'off'}>
              <input type="checkbox" checked={usable && on.has(d)} disabled={!usable} onChange={() => toggle(d)} />
              <strong>{d}</strong> <span className="muted">{usable ? range(waves[d]) : t('no usable images')}</span>
            </label>
          )
        })}
      </fieldset>

      <div className="tl-view bands-view" style={{ width: VIEW, height: VIEW }}>
        <canvas ref={canvasRef} width={W} height={H} />
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {visit.predicted && (
            <g stroke="#7fd8ff" strokeWidth="0.25">
              <line x1={sx(visit.predicted.x) - 1.2} x2={sx(visit.predicted.x) + 1.2} y1={sy(visit.predicted.y)} y2={sy(visit.predicted.y)} />
              <line x1={sx(visit.predicted.x)} x2={sx(visit.predicted.x)} y1={sy(visit.predicted.y) - 1.2} y2={sy(visit.predicted.y) + 1.2} />
            </g>
          )}
          {one && <circle cx={sx(one.x)} cy={sy(one.y)} r="1.6" fill="none" stroke="#f5c451" strokeWidth="0.25" />}
        </svg>
        <span className="tl-compass">N ↑ · E ←</span>
        {!sum && <span className="bands-empty">{t('No images from the selected detectors in this visit')}</span>}
      </div>

      <div className="tl-controls">
        <button className="btn tl-play" onClick={() => setPlaying((p) => !p)}>
          {playing ? t('Pause') : t('Play')}
        </button>
        <input
          type="range"
          min="0"
          max={visits.length - 1}
          value={index}
          onChange={(e) => {
            setPlaying(false)
            setIndex(Number(e.target.value))
          }}
          aria-label={t('Visit')}
        />
      </div>
      <p className="small-label">
        {t('Visit {n} of {total}', { n: index + 1, total: visits.length })} · {visit.from} → {visit.to} ·{' '}
        {selected.length
          ? `${selected.join(' + ')} · ${selected.reduce((n, d) => n + (visit.bands?.[d]?.images ?? 0), 0)} ${t('images added up')}`
          : t('No detector selected')}
        {' · '}
        {t('cross = expected position')}
        {one ? ` · ${t('circle = position measured in {d}', { d: selected[0] })}` : ''}
      </p>

      <h4 className="bands-title">{t('Motion per detector')}</h4>
      <table className="bands-table">
        <thead>
          <tr>
            <th>{t('Detector')}</th>
            <th>{t('Measured E / N')}</th>
            <th>{t('Expected E / N')}</th>
          </tr>
        </thead>
        <tbody>
          {DETS.map((d) => {
            const m = bands.motion?.[d]
            return (
              <tr key={d}>
                <td>{d}</td>
                {m ? (
                  <>
                    <td>
                      {fmt(m.measured_arcsec?.east)} / {fmt(m.measured_arcsec?.north)}
                    </td>
                    <td>
                      {fmt(m.predicted_arcsec?.east)} / {fmt(m.predicted_arcsec?.north)}
                    </td>
                  </>
                ) : (
                  <td colSpan={2} className="muted">
                    {t('too faint or saturated')}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="small-label">{t('Shift between visits; east = left on the image, north = up.')}</p>
      {bands.how_to_read && <p className="hint">{bands.how_to_read}</p>}
    </div>
  )
}
