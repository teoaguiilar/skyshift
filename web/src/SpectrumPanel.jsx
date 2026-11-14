/*
 * SkyShift — spectrum panel for the guided-tour objects (data/<object>/spectrum.json by the data pipeline).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 */
import { useEffect, useState } from 'react'
import { SpectrumChart } from './Charts.jsx'

const DATA_BASE = 'https://raw.githubusercontent.com/teoaguiilar/skyshift/main/data'

export default function SpectrumPanel({ id }) {
  const [spectrum, setSpectrum] = useState(null)
  useEffect(() => {
    setSpectrum(null)
    if (!id) return
    fetch(`${DATA_BASE}/${id}/spectrum.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSpectrum)
      .catch(() => setSpectrum(null))
  }, [id])
  if (!spectrum) return null
  return <SpectrumChart spectrum={spectrum} />
}
