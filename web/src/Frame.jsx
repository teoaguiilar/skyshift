// Viewer frame for one SPHEREx image: pixelated, viewfinder corners and cyan ticks at the position SkyShift measured.
// Uses the manifest: grid.center_ra_deg/center_dec_deg, pixel_scale_arcsec, png_upscale; frame.measured.ra_deg/dec_deg.
// PNGs have north up and east left. Drafted with help from Claude (Anthropic); reviewed by the SkyShift Murcia team.
export function measuredXY(grid, measured) {
  const s = grid.png_upscale / grid.pixel_scale_arcsec // PNG pixels per arcsec
  const cos = Math.cos((grid.center_dec_deg * Math.PI) / 180)
  const x = (grid.width * grid.png_upscale) / 2 - (measured.ra_deg - grid.center_ra_deg) * cos * 3600 * s
  const y = (grid.height * grid.png_upscale) / 2 - (measured.dec_deg - grid.center_dec_deg) * 3600 * s
  return { x, y, W: grid.width * grid.png_upscale, H: grid.height * grid.png_upscale }
}

// Corners + measured-position ticks, drawn over an image of side `size` px (used by Frame and by the player).
export function FrameOverlay({ size, grid, measured }) {
  const m = measured && Number.isFinite(measured.ra_deg) && grid ? measuredXY(grid, measured) : null
  const k = m ? size / m.W : 1
  const f = Math.min(1, size / 300) // smaller frames get proportionally smaller marks
  const c = 14 * f,
    g = 16 * f,
    t = 34 * f // corner, gap, tick end
  return (
    <svg className="overlay" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path
        d={`M1 ${c}V1h${c}M${size - c - 1} 1h${c}v${c}M${size - 1} ${size - c - 1}v${c}h-${c}M${c + 1} ${size - 1}H1v-${c}`}
        fill="none"
        stroke="var(--muted)"
        strokeWidth="1.2"
      />
      {m &&
        !Number.isNaN(m.x) &&
        (() => {
          const x = m.x * k,
            y = m.y * k
          return (
            <g stroke="var(--accent)" strokeWidth="1.5">
              <line x1={x - t} y1={y} x2={x - g} y2={y} />
              <line x1={x + g} y1={y} x2={x + t} y2={y} />
              <line x1={x} y1={y - t} x2={x} y2={y - g} />
            </g>
          )
        })()}
    </svg>
  )
}

export default function Frame({ src, grid, frame, label, size = 300 }) {
  return (
    <figure className="frame" style={{ margin: 0, width: size }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <img src={src} alt={`SPHEREx image, ${frame?.date ?? ''}`} width={size} height={size} />
        <FrameOverlay size={size} grid={grid} measured={frame?.measured} />
      </div>
      <figcaption>
        <span>{label}</span>
        <b>{frame?.date}</b>
      </figcaption>
    </figure>
  )
}
