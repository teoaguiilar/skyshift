/*
 * SkyShift — "Report a candidate": a form that writes the proposal in the same JSON format as the
 * science cards (science/cards/_template.json), plus where and when it was seen.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 *
 * How a proposal reaches SkyShift (no accounts or personal data on our side):
 *   1. The person fills this form; the web checks that every number has a source.
 *   2. "Send for review" opens a public GitHub issue with the JSON (GitHub account needed).
 *   3. The SkyShift team reviews it. Only if the team approves it, it is saved as
 *      science/candidates/<id>.json and listed in science/candidates/index.json, and then it
 *      appears on the SkyShift map as a community candidate.
 */
import { useMemo, useState } from 'react'
import { t } from './i18n.js'

const ISSUES_URL = 'https://github.com/teoaguiilar/skyshift/issues/new'
const MAX_URL = 7500 // GitHub refuses very long links; longer proposals are pasted by hand
const emptyFact = () => ({ label: '', value: '', unit: '', source: '', source_url: '' })
const emptyPaper = () => ({ title: '', authors: '', url: '' })
const isUrl = (u) => /^https?:\/\/\S+\.\S+/.test(u.trim())

export function candidateId(ra, dec) {
  return `candidate-${ra.toFixed(4)}${dec >= 0 ? '+' : ''}${dec.toFixed(4)}`.replace(/\./g, 'p')
}

// context: { ra, dec, band, wavelength_um?, dates?: [first, last], imageDate?, objectName? }
export default function ReportForm({ context, onClose }) {
  const [kind, setKind] = useState(context.kind === 'varies' ? 'varies' : 'moves') // variable stars: "changes brightness"
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [why, setWhy] = useState('')
  const [evidence, setEvidence] = useState('')
  const [facts, setFacts] = useState([])
  const [papers, setPapers] = useState([])
  const [copied, setCopied] = useState(false)
  const [tried, setTried] = useState(false)

  const card = useMemo(() => {
    const kindText = { moves: 'candidate moving object', varies: 'candidate variable', other: 'candidate (other)' }[kind]
    return {
      id: candidateId(context.ra, context.dec),
      name: name.trim() || `Candidate near RA ${context.ra.toFixed(3)}, Dec ${context.dec.toFixed(3)}`,
      type: `Community ${kindText}`,
      status: 'proposed',
      summary: summary.trim(),
      why_interesting: why.trim(),
      position: { ra_deg: Number(context.ra.toFixed(6)), dec_deg: Number(context.dec.toFixed(6)), frame: 'ICRS' },
      seen_in: {
        data: 'NASA SPHEREx via IRSA, as shown in SkyShift',
        detector: context.band ?? null,
        wavelength_um: context.wavelength_um ?? null,
        dates: context.dates ?? null,
        image_looked_at: context.imageDate ?? null,
        near_object: context.objectName ?? null,
        link: window.location.href,
      },
      evidence: evidence.trim(),
      facts: facts.filter((f) => f.label.trim() || f.value.trim()).map((f) => ({ ...f, compare: '' })),
      papers: papers.filter((p) => p.title.trim() || p.url.trim()),
      written_by: 'community (see the GitHub issue)',
      reviewed_by: null,
    }
  }, [kind, name, summary, why, evidence, facts, papers, context])

  // Rules of the science cards: every number with its source, and real links.
  const problems = []
  if (card.summary.length < 20) problems.push(t('Describe what you see (at least one sentence).'))
  if (card.evidence.length < 10) problems.push(t('Say which images or catalogues show it.'))
  card.facts.forEach((f, i) => {
    if (!f.label.trim() || !f.value.trim()) problems.push(t('Fact {n}: write both the name and the value.', { n: i + 1 }))
    if (!f.source.trim() || !isUrl(f.source_url)) problems.push(t('Fact {n}: every number needs a source and a working link.', { n: i + 1 }))
  })
  card.papers.forEach((p, i) => {
    if (!p.title.trim() || !isUrl(p.url)) problems.push(t('Paper {n}: write its title and a working link.', { n: i + 1 }))
  })
  const text = /\S+@\S+\.\S+|\+?\d[\d\s-]{8,}\d/.test(JSON.stringify(card))
  if (text) problems.push(t('Please remove emails and phone numbers: no personal data.'))

  const json = JSON.stringify(card, null, 2)
  const issueUrl = (withJson) => {
    const body = [
      'A proposal from SkyShift for the team to review. Format: science card JSON (see science/cards/README.md).',
      '',
      withJson ? '```json\n' + json + '\n```' : '_The JSON was too long for a link: paste it here from your clipboard._',
      '',
      '_Approved proposals are saved in science/candidates/ and shown on the SkyShift map. A candidate is not a discovery until it is checked._',
    ].join('\n')
    const q = new URLSearchParams({ title: `[Candidate] ${card.name}`, labels: 'candidate', body })
    return `${ISSUES_URL}?${q.toString()}`
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const send = async () => {
    setTried(true)
    if (problems.length) return
    let url = issueUrl(true)
    if (url.length > MAX_URL) {
      await copy()
      url = issueUrl(false)
    }
    window.open(url, '_blank', 'noopener')
  }

  const setRow = (list, setList, i, key) => (e) => setList(list.map((r, k) => (k === i ? { ...r, [key]: e.target.value } : r)))

  return (
    <div className="rf-back" role="dialog" aria-modal="true" aria-label={t('Report a candidate')} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="rf" onSubmit={(e) => e.preventDefault()}>
        <header className="rf-head">
          <h3>{t('Report a candidate')}</h3>
          <button type="button" className="rf-x" onClick={onClose} aria-label={t('Close')}>
            ×
          </button>
        </header>
        <p className="small-label">
          {t(
            'Your proposal uses the same format as the SkyShift science cards. It is sent as a public GitHub issue (a GitHub account is needed) and appears on the SkyShift map only after the team reviews and approves it.',
          )}
        </p>

        <div className="rf-where">
          <span>
            RA {context.ra.toFixed(5)}° · Dec {context.dec.toFixed(5)}°
          </span>
          <span className="muted">
            {[context.objectName, context.band, context.wavelength_um && `${Number(context.wavelength_um).toFixed(2)} µm`, context.dates?.join(' → ')]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>

        <label>
          {t('What do you see?')}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="moves">{t('Something that moves between dates')}</option>
            <option value="varies">{t('Something that changes brightness')}</option>
            <option value="other">{t('Something else')}</option>
          </select>
        </label>
        <label>
          {t('Name (optional; a catalogue name if it has one)')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2MASS J…" />
        </label>
        <label>
          {t('Description: 2-3 simple sentences')}*
          <textarea rows="3" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <label>
          {t('Why it is interesting (optional)')}
          <textarea rows="2" value={why} onChange={(e) => setWhy(e.target.value)} />
        </label>
        <label>
          {t('Evidence: which images or catalogues show it? Did you check Gaia DR3 or SIMBAD?')}*
          <textarea rows="3" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        </label>

        <fieldset>
          <legend>{t('Facts (optional): every number needs a source')}</legend>
          {facts.map((f, i) => (
            <div className="rf-row" key={i}>
              <input placeholder={t('Name, e.g. Distance')} value={f.label} onChange={setRow(facts, setFacts, i, 'label')} />
              <input placeholder={t('Value')} value={f.value} onChange={setRow(facts, setFacts, i, 'value')} />
              <input placeholder={t('Unit')} value={f.unit} onChange={setRow(facts, setFacts, i, 'unit')} />
              <input placeholder={t('Source, e.g. Gaia DR3')} value={f.source} onChange={setRow(facts, setFacts, i, 'source')} />
              <input placeholder="https://…" value={f.source_url} onChange={setRow(facts, setFacts, i, 'source_url')} />
              <button type="button" className="rf-del" onClick={() => setFacts(facts.filter((_, k) => k !== i))} aria-label={t('Remove')}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-link" onClick={() => setFacts([...facts, emptyFact()])}>
            + {t('Add a fact')}
          </button>
        </fieldset>

        <fieldset>
          <legend>{t('Papers (optional)')}</legend>
          {papers.map((p, i) => (
            <div className="rf-row" key={i}>
              <input placeholder={t('Title')} value={p.title} onChange={setRow(papers, setPapers, i, 'title')} />
              <input placeholder={t('First author et al. (year)')} value={p.authors} onChange={setRow(papers, setPapers, i, 'authors')} />
              <input placeholder="https://ui.adsabs.harvard.edu/…" value={p.url} onChange={setRow(papers, setPapers, i, 'url')} />
              <button type="button" className="rf-del" onClick={() => setPapers(papers.filter((_, k) => k !== i))} aria-label={t('Remove')}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-link" onClick={() => setPapers([...papers, emptyPaper()])}>
            + {t('Add a paper')}
          </button>
        </fieldset>

        {tried && problems.length > 0 && (
          <ul className="rf-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <details className="rf-json">
          <summary>{t('See the JSON')}</summary>
          <pre>{json}</pre>
        </details>

        <div className="rf-actions">
          <button type="button" className="btn btn-link" onClick={copy}>
            {copied ? t('Copied') : t('Copy JSON')}
          </button>
          <button type="button" className="btn btn-primary" onClick={send}>
            {t('Send for review on GitHub ↗')}
          </button>
        </div>
        <p className="small-label">{t('No personal data, please. A candidate is not a discovery until it is checked.')}</p>
      </form>
    </div>
  )
}
