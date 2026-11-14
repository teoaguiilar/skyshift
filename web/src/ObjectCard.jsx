/*
 * SkyShift — "About this object" card for the guided-tour objects.
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 * Texts and numbers come from science/cards/<id>.json, written by the science team (Benjamín, Juan)
 * with a source for every number. The web reads them from GitHub, so edits appear without redeploying.
 */
// The card JSON is loaded by the player (TimeLapse) and passed in.
export default function ObjectCard({ card }) {
  if (!card) return null // no card yet: show nothing rather than an empty box

  return (
    <section className="card">
      {card.type && <p className="card-type">{card.type}</p>}
      {card.summary && <p>{card.summary}</p>}
      {card.why_interesting && (
        <p>
          <strong>Why it matters here: </strong>
          {card.why_interesting}
        </p>
      )}

      {card.facts?.length > 0 && (
        <ul className="facts">
          {card.facts.map((f, k) => (
            <li key={k}>
              <span className="fact-label">{f.label}</span>
              <span className="fact-value">
                {f.value} {f.unit}
              </span>
              {f.compare && <span className="fact-compare">{f.compare}</span>}
              {f.source && (
                <span className="fact-source">
                  Source:{' '}
                  {f.source_url ? (
                    <a href={f.source_url} target="_blank" rel="noreferrer">
                      {f.source}
                    </a>
                  ) : (
                    f.source
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {card.papers?.length > 0 && (
        <>
          <h4>Read the science</h4>
          <ul className="papers">
            {card.papers.map((p, k) => (
              <li key={k}>
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.title}
                </a>
                {p.authors && <span className="muted"> · {p.authors}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
