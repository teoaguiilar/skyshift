/*
 * SkyShift — card for a Gaia DR3 star clicked on the map (Science mode).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Values come from Gaia DR3 (through /api/gaia). The common name, if the star has one, comes from
 * SIMBAD through the CDS Sesame resolver, asked with the Gaia DR3 designation.
 */
import { t } from './i18n.js'
import { useEffect, useState } from 'react'

// Colour bins for the map (Gaia BP-RP colour, in magnitudes): bluer = hotter, redder = cooler.
// Interstellar dust also makes stars look redder, so colour is a hint, not a spectral type.
export const GAIA_BINS = [
  { max: 0.5, color: '#a9c4ff', label: '< 0.5' },
  { max: 1.0, color: '#f4f2ff', label: '0.5–1' },
  { max: 1.5, color: '#ffe3a3', label: '1–1.5' },
  { max: 2.5, color: '#ffb36b', label: '1.5–2.5' },
  { max: Infinity, color: '#ff7f50', label: '≥ 2.5' },
]
export const GAIA_NO_COLOUR = 'rgba(138,145,156,0.8)'
export const binFor = (bpRp) => (Number.isFinite(bpRp) ? GAIA_BINS.findIndex((b) => bpRp < b.max) : -1)

async function simbadName(designation, signal) {
  const r = await fetch(`https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/S?${encodeURIComponent(designation)}`, { signal })
  const xml = await r.text()
  const m = xml.match(/<oname>([^<]+)<\/oname>/)
  return m ? m[1].trim() : null
}

const fmt = (v, n) => (Number.isFinite(v) ? v.toFixed(n) : '—')

export default function GaiaStar({ star, onClose }) {
  const [name, setName] = useState({ for: null, value: null })

  useEffect(() => {
    const ctrl = new AbortController()
    simbadName(star.designation, ctrl.signal)
      .then((value) => setName({ for: star.designation, value: value && value !== star.designation ? value : '' }))
      .catch(() => !ctrl.signal.aborted && setName({ for: star.designation, value: false }))
    return () => ctrl.abort()
  }, [star.designation])

  const simbad = `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(star.designation)}`
  const known = name.for === star.designation ? name.value : null

  return (
    <div className="star-card" role="dialog" aria-label="Gaia star">
      <button className="star-close" onClick={onClose} aria-label={t('Close')}>
        ×
      </button>
      <span className="star-id">{star.designation}</span>
      <span className="star-name">
        {known === null
          ? t('Looking up the name in SIMBAD…')
          : known === false
            ? t('SIMBAD did not answer: use the link below')
            : known || t('No other name in SIMBAD')}
      </span>
      <dl>
        <dt>G</dt>
        <dd>{fmt(star.G, 2)} mag</dd>
        <dt>BP−RP</dt>
        <dd>{fmt(star.bp_rp, 2)} mag</dd>
        <dt>{t('Parallax')}</dt>
        <dd>{fmt(star.parallax, 3)} mas</dd>
        <dt>{t('Motion')}</dt>
        <dd>
          {fmt(star.pmra, 1)}, {fmt(star.pmdec, 1)} mas/yr
        </dd>
      </dl>
      <a href={simbad} target="_blank" rel="noreferrer">
        {t('Open in SIMBAD ↗')}
      </a>
    </div>
  )
}
