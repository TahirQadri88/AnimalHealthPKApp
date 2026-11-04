// The redesign's class translation table, applied the same way to every screen.
//
//   node tools/ui-preview/kt-classmap.mjs <file.jsx> [...]   rewrites in place, prints a report
//
// Tailwind class tokens only, with their variant prefixes (hover:, sm:, focus: ...) and the
// ! important marker kept.
// Colours keep their MEANING: rose/red is money owed or a warning, emerald/green is paid,
// amber is a draft or caution, indigo/violet/blue is advance or information; the main
// action buttons become the brand primary. Gradients are only reported: each needs a
// decision, not a substitution. Behaviour cannot change: no JSX outside class strings is
// touched. Review the diff and measure with contrast.mjs afterwards.
import { readFileSync, writeFileSync } from 'node:fs';

const semantic = (hue) => ({ rose: 'red', red: 'red', emerald: 'green', green: 'green', teal: 'green', amber: 'amber', orange: 'amber', yellow: 'amber',
  indigo: 'blue', violet: 'blue', purple: 'blue', blue: 'blue', sky: 'blue' }[hue]);

const map = (t) => {
  if (/^text-\[(9|9\.5|10|11)px\]$/.test(t)) return 'text-xs';
  if (t === 'font-black' || t === 'font-extrabold') return 'font-semibold';
  if (t === 'font-bold') return 'font-medium';
  if (['uppercase', 'tracking-wider', 'tracking-widest', 'tracking-wide', 'tracking-tight', 'italic',
       'shadow', 'shadow-sm', 'shadow-md', 'shadow-inner', 'backdrop-blur-sm', 'backdrop-blur-md'].includes(t)) return '';
  // Large shadows belong to things that float (menus, pop-ups, toasts): they keep one soft,
  // neutral shadow so they stand off what is behind them. Cards lose theirs to a hairline.
  if (['shadow-lg', 'shadow-xl', 'shadow-2xl'].includes(t)) return 'shadow-[0_8px_24px_rgba(0,0,0,0.08)]';
  if (/^shadow-[a-z]+-\d{2,3}(\/\d+)?$/.test(t)) return '';
  if (t === 'rounded-2xl') return 'rounded-xl';
  if (t === 'rounded-3xl') return 'rounded-2xl';
  if (t === 'rounded-t-3xl') return 'rounded-t-2xl';
  if (t === 'transition-all') return 'transition-colors';
  if (t === 'scale-95') return 'scale-[0.98]';
  let m;
  if ((m = t.match(/^(text|bg|border|divide|ring|accent|placeholder|decoration)-slate-(\d{2,3})(\/\d+)?$/))) {
    const [, k, n, op] = m; const v = Number(n);
    if (k === 'text' || k === 'placeholder') return `${k}-kt-${v >= 700 ? 'ink' : v >= 500 ? 'sub' : 'muted'}`;
    if (k === 'bg') return v >= 800 ? (op && v === 900 ? 'bg-black/50' : 'bg-kt-band') : v >= 200 ? 'bg-kt-line' : `bg-kt-raised${op || ''}`;
    return `${k}-kt-line`;
  }
  if ((m = t.match(/^(text|bg|border|ring|accent|divide|placeholder|decoration)-(rose|red|emerald|green|teal|amber|orange|yellow|indigo|violet|purple|blue|sky)-(\d{2,3})(\/\d+)?$/))) {
    const [, k, hue, n] = m; const v = Number(n); const s = semantic(hue);
    if (k === 'bg') {
      if (v <= 100) return `bg-kt-${s}/10`;
      if (v <= 300) return `bg-kt-${s}/20`;
      if (s === 'blue' || (s === 'green' && hue !== 'green')) return v >= 700 ? 'bg-kt-primary/90' : 'bg-kt-primary';
      return v >= 700 ? `bg-kt-${s}/90` : `bg-kt-${s}`;
    }
    if (k === 'text' || k === 'placeholder') return `${k}-kt-${s}`;
    if (k === 'accent') return 'accent-kt-primary';
    return `${k}-kt-${s}/30`;
  }
  return null;
};

const report = [];
for (const file of process.argv.slice(2)) {
  let src = readFileSync(file, 'utf8'), changed = 0;
  const gradients = new Set();
  // A class-ish token: optional variant prefixes, then the utility, bounded by quote/space/backtick/brace.
  src = src.replace(/(?<=[\s"'`{])((?:[a-z0-9-]+:)*!?)([a-z][a-z0-9.\-/\[\]]*)(?=[\s"'`}])/g, (all, prefix, base) => {
    if (/^(bg-gradient-|from-|via-|to-)/.test(base) && /-\d{2,3}$/.test(base)) { gradients.add(base); return all; }
    const to = map(base);
    if (to === null) return all;
    changed++;
    return to ? prefix + to : '';
  });
  // Collapse the doubled spaces left by removed tokens, inside class strings only.
  src = src.replace(/className=(["'`])([^"'`]*)\1/g, (m, q, body) => `className=${q}${body.replace(/ {2,}/g, ' ').trim()}${q}`);
  writeFileSync(file, src);
  report.push(`${file}: ${changed} classes${gradients.size ? `; gradients left for review: ${[...gradients].join(' ')}` : ''}`);
}
console.log(report.join('\n'));
