#!/usr/bin/env node
/*
 * lint-standards — fail the build when code violates a CLAUDE.md rule that
 * eslint / stylelint don't cover. Companion to lint-i18n.mjs; same shape.
 *
 * Why this exists: an audit on 2026-08-16 found that every rule the build
 * enforces stays clean and every rule that lives only in CLAUDE.md erodes —
 * 76 hardcoded hex colours, 24 unjustified `!important`s, raw <input>s in
 * feature templates — while `*ngIf`, constructor injection, and DTO suffixes
 * (all lint-enforced) sit at zero. So the prose rules become checks.
 *
 * Two classes of rule:
 *
 *  HARD — must be zero everywhere. Exceptions are listed by path in
 *         scripts/.lint-standards-allow with a reason (one per line:
 *         `<rule> <path> — <why>`), never by weakening the check.
 *    • console.log in non-spec .ts        (CLAUDE.md "What NOT to Do")
 *
 *  RATCHET — legacy debt too large to fix in one commit, tracked PER FILE in
 *         scripts/standards-baseline.json. A file not in the baseline must be
 *         clean (new code follows the rule); a baselined file may not exceed
 *         its count; a file that improved or disappeared FAILS until you rerun
 *         with FORGE_STANDARDS_UPDATE_BASELINE=1 and commit the rewritten
 *         baseline in the same change. It only tightens — never hand-edit a
 *         number upward.
 *    • ngModel / FormsModule in features  (Reactive forms only — 2 legacy dialogs)
 *    • hex colour literals in .scss       (use design tokens / CSS custom props)
 *    • `!important` without an adjacent   (third-party overrides only, and
 *      justifying comment                   they must say so)
 *    • inline `template:` in components   (templateUrl only)
 *    • raw <input>/<select>/<textarea> in (use the shared wrappers — see
 *      feature templates                    "Form Controls" in CLAUDE.md)
 *
 * Exit code: 0 on pass, 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'app');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'standards-baseline.json');
const ALLOW_PATH = path.join(ROOT, 'scripts', '.lint-standards-allow');
const UPDATE = process.env.FORGE_STANDARDS_UPDATE_BASELINE === '1' || process.env.FORGE_STANDARDS_UPDATE_BASELINE === 'true';

// ── file walking ─────────────────────────────────────────────────────────────

function* walk(dir, exts) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      yield* walk(full, exts);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      yield full;
    }
  }
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8');
const inFeatures = (p) => rel(p).startsWith('src/app/features/');
const isSpec = (p) => p.endsWith('.spec.ts');

// ── rule implementations: each returns Map<relPath, count> ───────────────────

function consoleLogInProdTs() {
  const out = new Map();
  for (const f of walk(SRC, ['.ts'])) {
    if (isSpec(f)) continue;
    const n = (read(f).match(/\bconsole\.log\(/g) ?? []).length;
    if (n) out.set(rel(f), n);
  }
  return out;
}

const stripTsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"])\/\/.*$/gm, '$1');
const stripHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

function ngModelInFeatures() {
  const out = new Map();
  for (const f of walk(SRC, ['.html', '.ts'])) {
    if (!inFeatures(f) || isSpec(f)) continue;
    const src = f.endsWith('.ts') ? stripTsComments(read(f)) : stripHtmlComments(read(f));
    // .ts: importing FormsModule (not ReactiveFormsModule) into a feature; .html: any ngModel binding.
    const re = f.endsWith('.ts')
      ? /(?<![A-Za-z])FormsModule\b/g
      : /\[\(ngModel\)\]|\(ngModelChange\)|\[ngModel\]|\bngModel(?=[\s=\]>])/g;
    const n = (src.match(re) ?? []).length;
    if (n) out.set(rel(f), n);
  }
  return out;
}

function hexColoursInScss() {
  const out = new Map();
  for (const f of walk(SRC, ['.scss'])) {
    // strip comments so a documented hex in a comment doesn't count
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const n = (src.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) ?? []).length;
    if (n) out.set(rel(f), n);
  }
  return out;
}

function unjustifiedImportant() {
  const out = new Map();
  for (const f of walk(SRC, ['.scss'])) {
    const lines = read(f).split('\n');
    let n = 0;
    lines.forEach((line, i) => {
      if (!/!important/.test(line)) return;
      const here = /\/\/|\/\*/.test(line);
      const above = i > 0 && /\/\/|\/\*|\*\//.test(lines[i - 1]);
      if (!here && !above) n++;
    });
    if (n) out.set(rel(f), n);
  }
  return out;
}

function inlineTemplates() {
  const out = new Map();
  for (const f of walk(SRC, ['.ts'])) {
    if (isSpec(f)) continue;
    const n = (read(f).match(/^\s*template:\s*`/gm) ?? []).length;
    if (n) out.set(rel(f), n);
  }
  return out;
}

function rawFormControlsInFeatures() {
  const out = new Map();
  const legitTypes = /type=["'](file|checkbox|radio|hidden|range|color|submit|button)["']/;
  for (const f of walk(SRC, ['.html'])) {
    if (!inFeatures(f)) continue;
    const src = read(f);
    let n = 0;
    for (const m of src.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
      const tag = m[0];
      if (legitTypes.test(tag)) continue;
      if (/\bmatInput\b|\bmatNativeControl\b|\bcdkTextareaAutosize\b/.test(tag)) continue; // Material-wrapped, not raw
      n++;
    }
    if (n) out.set(rel(f), n);
  }
  return out;
}

// ── evaluation ───────────────────────────────────────────────────────────────

const HARD = [
  ['console-log', 'console.log in non-spec .ts (CLAUDE.md: never in production code)', consoleLogInProdTs],
];

const RATCHET = [
  ['ngmodel-in-features', 'ngModel / FormsModule in a feature (Reactive forms only)', ngModelInFeatures],
  ['hex-colours-in-scss', 'hex colour literal in .scss (use design tokens / CSS custom properties)', hexColoursInScss],
  ['unjustified-important', '`!important` without an adjacent justifying comment', unjustifiedImportant],
  ['inline-templates', 'inline `template:` (use templateUrl)', inlineTemplates],
  ['raw-form-controls-in-features', 'raw <input>/<select>/<textarea> in a feature template (use the shared wrappers)', rawFormControlsInFeatures],
];

function loadAllow() {
  // "<rule> <path> — <reason>" per line; '#' comments; blank lines ignored.
  const allow = new Map();
  if (!fs.existsSync(ALLOW_PATH)) return allow;
  for (const raw of read(ALLOW_PATH).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [rule, p] = line.split(/\s+/);
    if (!allow.has(rule)) allow.set(rule, new Set());
    allow.get(rule).add(p);
  }
  return allow;
}

function loadBaseline() {
  return fs.existsSync(BASELINE_PATH) ? JSON.parse(read(BASELINE_PATH)) : {};
}

const failures = [];
const allow = loadAllow();
const baseline = loadBaseline();
const nextBaseline = {};

for (const [rule, desc, fn] of HARD) {
  const found = fn();
  const allowed = allow.get(rule) ?? new Set();
  for (const [file, n] of found) {
    if (allowed.has(file)) continue;
    failures.push(`HARD  ${rule}: ${file} (${n}) — ${desc}. If this is a justified exception, add it to scripts/.lint-standards-allow with a reason.`);
  }
  for (const p of allowed) {
    if (!found.has(p)) failures.push(`STALE ALLOW  ${rule}: ${p} is allowlisted but clean — remove it from scripts/.lint-standards-allow.`);
  }
}

for (const [rule, desc, fn] of RATCHET) {
  const found = fn();
  const recorded = baseline[rule] ?? {};
  nextBaseline[rule] = Object.fromEntries([...found].sort(([a], [b]) => a.localeCompare(b)));
  if (UPDATE) continue;

  for (const [file, n] of found) {
    if (!(file in recorded)) failures.push(`NEW VIOLATION  ${rule}: ${file} (${n}) — ${desc}. New code must follow the rule.`);
    else if (n > recorded[file]) failures.push(`DEBT GREW  ${rule}: ${file} ${n} > baseline ${recorded[file]}.`);
    else if (n < recorded[file]) failures.push(`RATCHET DOWN  ${rule}: ${file} ${n} < baseline ${recorded[file]} — nice; rerun with FORGE_STANDARDS_UPDATE_BASELINE=1 and commit scripts/standards-baseline.json.`);
  }
  for (const file of Object.keys(recorded)) {
    if (!found.has(file)) failures.push(`STALE ENTRY  ${rule}: ${file} is in the baseline but clean/gone — rerun with FORGE_STANDARDS_UPDATE_BASELINE=1 and commit scripts/standards-baseline.json.`);
  }
}

if (UPDATE) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(nextBaseline, null, 2) + '\n');
  const summary = Object.entries(nextBaseline).map(([r, files]) => `  ${r}: ${Object.keys(files).length} files, ${Object.values(files).reduce((a, b) => a + b, 0)} occurrences`).join('\n');
  console.log(`lint-standards: baseline rewritten →\n${summary}`);
}

if (failures.length) {
  console.error(`\nlint-standards: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(`\nSee scripts/lint-standards.mjs header for the rules and the ratchet contract.`);
  process.exit(1);
}

const totals = RATCHET.map(([r]) => `${r}=${Object.keys(baseline[r] ?? {}).length}`).join(' ');
console.log(`OK: lint-standards — hard rules clean; ratchet holds (baselined files: ${totals}).`);
process.exit(0);
