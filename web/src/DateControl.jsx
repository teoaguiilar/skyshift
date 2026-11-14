/*
 * SkyShift — "Sky date" control in the corner of the map (like the date picker of street imagery in map apps).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 *
 * What the date changes (honestly): the background map is ONE combined SPHEREx all-sky map, so it does
 * not change. The date picks which SPHEREx image the time-lapse shows (it snaps to the dates SPHEREx
 * actually observed), moves the Gaia DR3 stars to that date with their proper motion, and places the
 * selected moving star where it is on that date.
 */
import { getLang, t } from './i18n.js'

export const mjdToDate = (mjd) => new Date((mjd - 40587) * 86400000)
export const mjdToYear = (mjd) => 2000 + (mjd - 51544.5) / 365.25
const todayMjd = () => Date.now() / 86400000 + 40587
const SPHEREX_START_MJD = 60789.75 // first data in the SPHEREx DR1 all-sky map (IRSA HiPS properties, t_min)

const fmt = (mjd) =>
  mjdToDate(mjd).toLocaleDateString(getLang() === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)

// player: { mjd, dates: [{mjd, date}] } from the time-lapse, or null. value: the free date (mjd) when there is no player.
export default function DateControl({ player, value, onPick, onFree }) {
  const dates = player?.dates ?? []
  const snapping = dates.length > 1
  const min = snapping ? dates[0].mjd : SPHEREX_START_MJD
  const max = snapping ? dates[dates.length - 1].mjd : todayMjd()
  const current = snapping ? player.mjd : (value ?? todayMjd())
  const idx = snapping ? dates.findIndex((d) => d.mjd === player.mjd) : -1

  const pick = (mjd) => {
    if (snapping) {
      let best = 0
      dates.forEach((d, i) => Math.abs(d.mjd - mjd) < Math.abs(dates[best].mjd - mjd) && (best = i))
      onPick(dates[best].mjd)
    } else onFree(mjd)
  }

  return (
    <div
      className="date-ctl"
      title={t(
        'The background map combines all SPHEREx images, so it does not change. The date picks the SPHEREx image of the time-lapse, moves the Gaia stars and shows where the star is on that date.',
      )}
    >
      <span className="date-head">
        <CalendarIcon />
        <span className="small-label">{t('Sky date')}</span>
        <strong>{fmt(current)}</strong>
      </span>
      <div className="date-row">
        {snapping && (
          <button onClick={() => idx > 0 && onPick(dates[idx - 1].mjd)} disabled={idx <= 0} aria-label={t('Previous image')}>
            ‹
          </button>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step="any"
          value={current}
          onChange={(e) => pick(Number(e.target.value))}
          aria-label={t('Sky date')}
          list={snapping ? 'skyshift-dates' : undefined}
        />
        {snapping && (
          <datalist id="skyshift-dates">
            {dates.map((d) => (
              <option key={d.mjd} value={d.mjd} />
            ))}
          </datalist>
        )}
        {snapping && (
          <button onClick={() => idx < dates.length - 1 && onPick(dates[idx + 1].mjd)} disabled={idx >= dates.length - 1} aria-label={t('Next image')}>
            ›
          </button>
        )}
      </div>
      <span className="date-foot small-label">
        {snapping
          ? t('{n} SPHEREx images · {from} → {to}', { n: dates.length, from: fmt(dates[0].mjd), to: fmt(dates[dates.length - 1].mjd) })
          : t('Pick an object or a spot to jump between SPHEREx images')}
      </span>
    </div>
  )
}
