// Small line icons for the action buttons, drawn in SVG code (no icon library).
// Code written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team. See AI_USAGE.md.
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
export const IconPlay = () => (
  <svg {...base}>
    <path d="M7 4l13 8-13 8z" />
  </svg>
)
export const IconLink = () => (
  <svg {...base}>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
)
export const IconFlag = () => (
  <svg {...base}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
)
export const IconWave = () => (
  <svg {...base}>
    <path d="M2 14c2-6 4-6 6 0s4 6 6 0 4-6 6 0 2 3 2 3" />
  </svg>
)
export const IconEye = () => (
  <svg {...base}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
