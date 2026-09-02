// Prove that an extraction was a PURE MOVE.
//
//   node tools/extraction-diff.mjs <Name> <newFile> [gitRef=HEAD] [oldFile=src/App.jsx]
//
// Why this exists. docs/APP_EXTRACTION.md originally said to snapshot a component's
// rendered markup before moving it. That cannot be done: a component still inside
// App.jsx cannot be imported by a test, because App.jsx imports src/firebase.js, which
// initialises Auth at import time and throws without credentials.
//
// So the proof works on the source instead, which for a pure move is stronger than a
// markup snapshot: it shows nothing changed at all, not merely that the output matched on
// the inputs a test happened to try. It takes the component's text out of the previous
// commit's App.jsx and out of the new file, normalises only the `export ` keyword, and
// requires the two to be byte-identical.
//
// Exit 0 means the move was pure. Anything else and the diff is on stdout.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [name, newFile, ref = 'HEAD', oldFile = 'src/App.jsx'] = process.argv.slice(2);
if (!name || !newFile) {
  console.error('usage: extraction-diff.mjs <Name> <newFile> [gitRef] [oldFile]');
  process.exit(2);
}

const DECL = /^(?:export\s+)?(?:const|function|class)\s+([A-Za-z_$][\w$]*)/;

// The end of a declaration is where its braces balance, NOT the next line starting with
// `const`. App.jsx is flat-formatted — nested declarations sit at column 0 too — so an
// indentation rule finds the component's first local variable and stops there. The first
// version of this tool did exactly that and cheerfully reported a 35-line component as
// "1 line identical", which is the sort of green tick that is worse than no check at all.
const stripLiterals = (line) => line
  .replace(/\\./g, '')                    // escapes first, so \" does not end a string
  .replace(/'[^']*'/g, "''")
  .replace(/"[^"]*"/g, '""')
  .replace(/`[^`]*`/g, '``')
  .replace(/\/\*.*?\*\//g, '')
  .replace(/\/\/.*$/, '');

const slice = (source, wanted) => {
  const lines = source.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(DECL);
    if (m && m[1] === wanted) { start = i; break; }
  }
  if (start === -1) return null;

  let depth = 0;
  let opened = false;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    for (const ch of stripLiterals(lines[i])) {
      if (ch === '{' || ch === '(' || ch === '[') { depth++; opened = true; }
      else if (ch === '}' || ch === ')' || ch === ']') depth--;
    }
    if (opened && depth <= 0) { end = i + 1; break; }
  }
  // Cross-check the brace result against the next top-level COMPONENT (capitalised). An
  // apostrophe in JSX text — "Driver's" — pairs with the next one hundreds of lines away
  // and eats every brace between them, so brace balance alone once reported a 459-line
  // component as 4,770 lines. Where the two disagree, the component boundary wins and the
  // tool says so, because a boundary you cannot trust must not print a tick.
  // A COMPONENT, not merely a capitalised name. `const PERMS = [` sits at column 0 inside
  // UserModal, and treating it as a boundary cut that component in half — with the tool
  // then comparing two identically-truncated slices and printing a tick. A component is
  // `const X = (` or `function X(`; `const X = [` is data.
  let nextComponent = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(?:export\s+)?(?:const\s+[A-Z][\w$]*\s*=\s*\(|function\s+[A-Z][\w$]*\s*\()/.test(lines[i])) {
      nextComponent = i; break;
    }
  }
  if (end > nextComponent) {
    console.warn(`  note: brace balance was unreliable for ${wanted} (probably an apostrophe in JSX text); using the next component as the boundary`);
    end = nextComponent;
  }

  return lines.slice(start, end).join('\n')
    .replace(/^export\s+/, '')   // the one difference a move is allowed to introduce
    .replace(/\s+$/, '');        // and trailing blank lines, which carry no meaning
};

const before = slice(execFileSync('git', ['show', `${ref}:${oldFile}`], { encoding: 'utf8' }), name);
const after = slice(readFileSync(newFile, 'utf8'), name);

if (before === null) { console.error(`✗ ${name} not found in ${ref}:${oldFile}`); process.exit(2); }
if (after === null) { console.error(`✗ ${name} not found in ${newFile}`); process.exit(2); }

if (before === after) {
  console.log(`✓ ${name}: pure move — ${before.split('\n').length} lines identical to ${ref}:${oldFile}`);
  process.exit(0);
}

console.error(`✗ ${name}: the moved code is NOT identical.\n`);
const a = before.split('\n');
const b = after.split('\n');
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) {
    console.error(`  line ${i + 1}`);
    console.error(`  before: ${a[i] ?? '(none)'}`);
    console.error(`  after : ${b[i] ?? '(none)'}`);
  }
}
process.exit(1);
