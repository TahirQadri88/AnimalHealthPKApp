// Status colour for the Analytics screens, as fills and markers rather than thin coloured text.
//
// Each tone has: `chip` (a light tint with the DARK text token on it, for figures and counts),
// `card` (a tinted card ground and border), `bar` (a solid marker: left edge, dot, chart bar, in
// the brighter --kt-icon-* tones that carry 3:1 as graphics), and `text` (the dark token alone).
// Words always sit in the dark text tokens; the bright ones never carry text. contrast.mjs
// measures every combination on screen.
export const TONES = {
  good:    { chip: 'bg-kt-icon-green/15 text-kt-green', card: 'bg-kt-icon-green/10 border-kt-icon-green/40', bar: 'bg-kt-icon-green', text: 'text-kt-green' },
  watch:   { chip: 'bg-kt-icon-amber/20 text-kt-amber', card: 'bg-kt-icon-amber/10 border-kt-icon-amber/50', bar: 'bg-kt-icon-amber', text: 'text-kt-amber' },
  bad:     { chip: 'bg-kt-icon-red/15 text-kt-red', card: 'bg-kt-icon-red/10 border-kt-icon-red/40', bar: 'bg-kt-icon-red', text: 'text-kt-red' },
  info:    { chip: 'bg-kt-icon-blue/15 text-kt-blue', card: 'bg-kt-icon-blue/10 border-kt-icon-blue/40', bar: 'bg-kt-icon-blue', text: 'text-kt-blue' },
  neutral: { chip: 'bg-kt-raised text-kt-muted', card: 'bg-white border-kt-line', bar: 'bg-kt-line', text: 'text-kt-muted' },
};
export const tone = (kind) => TONES[kind] || TONES.neutral;

// Bands used across the screen, in one place so a figure is never green on one card and amber on the next.
export const marginTone = (pct) => (pct === null || pct === undefined || Number.isNaN(Number(pct)) ? 'neutral' : Number(pct) < 5 ? 'bad' : Number(pct) < 15 ? 'watch' : 'good');
export const recoveryTone = (pct) => (pct === null ? 'neutral' : Number(pct) >= 80 ? 'good' : Number(pct) >= 50 ? 'watch' : 'bad');
export const trendTone = (pct) => (pct === null ? 'neutral' : Number(pct) >= 0 ? 'good' : 'bad');
export const daysTone = (d) => (d === null ? 'neutral' : d <= 7 ? 'good' : d <= 21 ? 'watch' : 'bad');
