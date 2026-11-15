/*
 * Is a sky position on one of the guided-tour objects? Used by the coordinate search (opens the object's
 * panel) and by "Spectrum (on the fly)" (shows the object's precomputed spectrum, so it works even when
 * IRSA is down). Fast-moving stars are matched anywhere along their path from the year-2000 catalogue
 * position to today's position (Barnard's Star has moved about 4.5′ since 2000).
 * Positions: the target of each manifest (SIMBAD via CDS Sesame).
 * Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
 */
export const TOUR_MATCH_ARCMIN = 1

let cache = null
export const loadTargets = (ids, base) =>
  (cache ??= Promise.all(
    ids.map((id) =>
      fetch(`${base}/${id}/manifest.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => (m?.target ? { id, ...m.target } : null))
        .catch(() => null),
    ),
  ).then((list) => list.filter(Boolean)))

export function tourObjectAt(ra, dec, targets) {
  const year = new Date().getFullYear() + new Date().getMonth() / 12
  let best = null
  for (const tg of targets) {
    const cosd = Math.cos((tg.dec_j2000_deg * Math.PI) / 180)
    // Offsets in arcmin on the sky, from the year-2000 position.
    const x = (((ra - tg.ra_j2000_deg + 540) % 360) - 180) * cosd * 60
    const y = (dec - tg.dec_j2000_deg) * 60
    const dt = year - 2000
    const px = (((tg.pmra_mas_yr ?? 0) * dt) / 3.6e6) * 60
    const py = (((tg.pmdec_mas_yr ?? 0) * dt) / 3.6e6) * 60
    const len2 = px * px + py * py
    const k = len2 > 0 ? Math.max(0, Math.min(1, (x * px + y * py) / len2)) : 0
    const d = Math.hypot(x - k * px, y - k * py)
    if (d <= TOUR_MATCH_ARCMIN && (!best || d < best.d)) best = { id: tg.id, ra: tg.ra_j2000_deg, dec: tg.dec_j2000_deg, d }
  }
  return best
}
