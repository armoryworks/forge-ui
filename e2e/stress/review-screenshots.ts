/**
 * Vision-model UI review tool (Ollama local).
 *
 * Reads screenshots from a completed audit run (audit-screenshots.ts),
 * sends each to Ollama llava for automated review, and produces a
 * structured report of visual defects and design system violations.
 *
 * For higher-quality review, use Claude Code directly:
 *   1. npm run audit:screenshots
 *   2. Ask Claude Code: "Review the screenshots in e2e/stress/screenshots/{runId}/"
 *
 * Usage:
 *   npx tsx e2e/stress/review-screenshots.ts [runId]
 *   npx tsx e2e/stress/review-screenshots.ts --theme light
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Config ──

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava:7b';

// ── Types ──

interface PageResult {
  name: string;
  theme: 'light' | 'dark';
  status: 'ok' | 'error';
  screenshotFile?: string;
  consoleErrors: string[];
  networkFailures: string[];
  errorMessage?: string;
}

interface AuditManifest {
  runId: string;
  capturedAt: string;
  summary: Record<string, number>;
  results: PageResult[];
}

interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: string;
  description: string;
  location: string;
}

interface ScreenshotReview {
  name: string;
  theme: string;
  screenshotFile: string;
  issues: ReviewIssue[];
  rawResponse: string;
  error?: string;
}

// ── System prompt ──

const SYSTEM_PROMPT = `You are a UI quality reviewer for a manufacturing ERP application called QB Engineer.
You review screenshots for visual defects, design system violations, and usability issues.

DESIGN SYSTEM RULES (violations of these are issues):
- Typography: Space Grotesk font family, 12px base font size, 11px for table body text, 9-10px for labels/uppercase helpers
- Corners: ALL elements must have sharp corners (0px border-radius). Any rounded corners on cards, buttons, inputs, panels, or containers are a violation. Exception: Material chips and toggles may retain rounded shape.
- Spacing: Dense, compact professional layout. 8px standard gap between sections, 4px within sections, 16px max panel body padding. No excessive whitespace.
- Layout: Must fit 1920x1080 viewport. No horizontal scrollbars. No content overflowing its container.
- Color: Uses CSS custom properties for theming (--primary, --bg, --surface, --border, --text, etc.)
- Buttons: 2rem (32px) height for action buttons, 24x24px for icon buttons. All-caps labels on small buttons.
- Inputs: Compact height (~2rem/32px), no inline validation text (validation is via hover popover on submit button)
- Header: 44px height application header bar
- Tables: Dense rows, 11px text, sortable column headers, alternating row colors not required
- Borders: 1px thin borders, 2px standard, 3px accent for status stripes (left/top colored borders)

WHAT TO CHECK:
1. TEXT ISSUES: Truncated text without ellipsis, overlapping text, unreadable text, wrong font rendering
2. SPACING ISSUES: Inconsistent gaps between similar elements, excessive whitespace wasting screen real estate, cramped elements touching each other
3. ALIGNMENT: Misaligned elements in rows/grids, uneven margins, form labels not aligned
4. OVERFLOW: Horizontal scrollbars, content cut off at edges, elements extending beyond their containers
5. THEME CONSISTENCY: In dark theme screenshots — un-themed white patches, wrong background colors, poor contrast making text unreadable, form fields with white backgrounds
6. EMPTY STATES: Lists/tables with no data should show an icon + message, not just blank/empty space
7. INTERACTIVE ELEMENTS: Buttons that look disabled or invisible, icon-only buttons without sufficient contrast, missing visual affordances
8. BORDER RADIUS: Cards, panels, inputs, buttons, or containers with rounded corners are a design system violation (0px border-radius required)
9. DATA DISPLAY: Date formats should be MM/dd/yyyy, person names should be "Last, First MI" format

RESPONSE FORMAT — you MUST respond with ONLY this JSON (no markdown, no explanation):
{"issues":[{"severity":"critical|major|minor|info","category":"text|spacing|alignment|overflow|theme|empty-state|border-radius|interactive|data-display","description":"Specific actionable description","location":"Where in the screenshot"}]}

If no issues found: {"issues":[]}

SEVERITY GUIDE:
- critical: Broken functionality, unreadable text, major overflow hiding content, completely blank page
- major: Design system violation (rounded corners, wrong spacing scale), significant theme issues, data cut off
- minor: Slight alignment issues, minor spacing inconsistencies, cosmetic imperfections
- info: Suggestions for improvement that are not actual defects`;

// ── Ollama vision provider ──

async function reviewWithOllama(imageBase64: string, pageName: string, theme: string): Promise<{ text: string }> {
  const prompt = `Review this screenshot of the "${pageName}" page in ${theme} theme. Identify any visual defects or design system violations. Respond with ONLY JSON.`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_VISION_MODEL,
      prompt,
      system: SYSTEM_PROMPT,
      stream: false,
      images: [imageBase64],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { response: string };
  return { text: data.response };
}

// ── Response parsing ──

function parseReviewResponse(raw: string): ReviewIssue[] {
  // Try direct parse
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.issues)) return validateIssues(parsed.issues);
  } catch { /* continue */ }

  // Try extracting from markdown code fence
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed.issues)) return validateIssues(parsed.issues);
    } catch { /* continue */ }
  }

  // Try finding first JSON object
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      if (Array.isArray(parsed.issues)) return validateIssues(parsed.issues);
    } catch { /* continue */ }
  }

  // Fallback: treat entire response as a single info issue
  if (raw.trim().length > 0) {
    return [{
      severity: 'info',
      category: 'text',
      description: `[Unparseable response] ${raw.slice(0, 500)}`,
      location: 'unknown',
    }];
  }

  return [];
}

function validateIssues(issues: unknown[]): ReviewIssue[] {
  const validSeverities = new Set(['critical', 'major', 'minor', 'info']);
  return issues
    .filter((i): i is Record<string, string> => typeof i === 'object' && i !== null)
    .map(i => ({
      severity: (validSeverities.has(i.severity) ? i.severity : 'info') as ReviewIssue['severity'],
      category: String(i.category || 'text'),
      description: String(i.description || 'No description'),
      location: String(i.location || 'unknown'),
    }));
}

// ── Report generation ──

function generateMarkdownReport(
  runId: string,
  reviews: ScreenshotReview[],
): string {
  const allIssues = reviews.flatMap(r => r.issues.map(i => ({ ...i, page: r.name, theme: r.theme })));
  const bySeverity = countBy(allIssues, i => i.severity);
  const byCategory = countBy(allIssues, i => i.category);

  const lines: string[] = [];
  lines.push('# UI Vision Review Report');
  lines.push('');
  lines.push(`**Run:** ${runId} | **Date:** ${new Date().toISOString().slice(0, 19)} | **Provider:** ollama (${OLLAMA_VISION_MODEL})`);
  lines.push(`**Screenshots reviewed:** ${reviews.length} | **Total issues:** ${allIssues.length}`);
  lines.push('');

  // Summary tables
  lines.push('## Summary by Severity');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of ['critical', 'major', 'minor', 'info']) {
    lines.push(`| ${sev} | ${bySeverity[sev] || 0} |`);
  }
  lines.push('');

  lines.push('## Summary by Category');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push('');

  // Critical & Major quick triage
  const criticalMajor = allIssues.filter(i => i.severity === 'critical' || i.severity === 'major');
  if (criticalMajor.length > 0) {
    lines.push('## Critical & Major Issues');
    lines.push('');
    const grouped = groupBy(criticalMajor, i => `${i.page} (${i.theme})`);
    for (const [page, issues] of Object.entries(grouped)) {
      lines.push(`### ${page}`);
      for (const issue of issues) {
        lines.push(`- **[${issue.severity}/${issue.category}]** ${issue.description} — _${issue.location}_`);
      }
      lines.push('');
    }
  }

  // All findings by page
  lines.push('## All Findings by Page');
  lines.push('');
  for (const review of reviews) {
    if (review.issues.length === 0) continue;
    lines.push(`### ${review.name} — ${review.theme}`);
    lines.push(`Screenshot: \`${review.screenshotFile}\``);
    lines.push('| # | Severity | Category | Location | Description |');
    lines.push('|---|----------|----------|----------|-------------|');
    review.issues.forEach((issue, idx) => {
      lines.push(`| ${idx + 1} | ${issue.severity} | ${issue.category} | ${issue.location} | ${issue.description} |`);
    });
    lines.push('');
  }

  // Clean pages
  const cleanPages = reviews.filter(r => r.issues.length === 0);
  if (cleanPages.length > 0) {
    lines.push('## Pages with No Issues');
    for (const r of cleanPages) {
      lines.push(`- ${r.name} (${r.theme})`);
    }
    lines.push('');
  }

  // Errors during review
  const errorPages = reviews.filter(r => r.error);
  if (errorPages.length > 0) {
    lines.push('## Review Errors');
    for (const r of errorPages) {
      lines.push(`- **${r.name} (${r.theme})**: ${r.error}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

// ── Main ──

async function main(): Promise<void> {
  // Parse args
  const args = process.argv.slice(2);
  let runId: string | undefined;
  let themeFilter: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) {
      themeFilter = args[++i];
    } else if (!args[i].startsWith('--')) {
      runId = args[i];
    }
  }

  // Find audit run directory
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!runId) {
    const dirs = fs.readdirSync(screenshotsDir)
      .filter(d => d.startsWith('audit-') && fs.statSync(path.join(screenshotsDir, d)).isDirectory())
      .sort()
      .reverse();

    if (dirs.length === 0) {
      console.error('No audit runs found. Run audit-screenshots.ts first.');
      process.exit(1);
    }
    runId = dirs[0];
  }

  const runDir = path.join(screenshotsDir, runId);
  const manifestPath = path.join(runDir, 'audit-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest: AuditManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Filter to successful screenshots only
  let toReview = manifest.results.filter(r => r.status === 'ok' && r.screenshotFile);
  if (themeFilter) {
    toReview = toReview.filter(r => r.theme === themeFilter);
  }

  console.log(`\nVision Review — Run: ${runId}`);
  console.log(`Provider: ollama (${OLLAMA_VISION_MODEL})`);
  console.log(`Screenshots to review: ${toReview.length}`);
  if (themeFilter) console.log(`Theme filter: ${themeFilter}`);
  console.log('');

  const reviews: ScreenshotReview[] = [];
  let totalIssues = 0;

  for (let i = 0; i < toReview.length; i++) {
    const result = toReview[i];
    const imagePath = path.join(runDir, result.screenshotFile!);

    if (!fs.existsSync(imagePath)) {
      console.log(`  ! [${i + 1}/${toReview.length}] ${result.name} (${result.theme}) — file missing, skipping`);
      continue;
    }

    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString('base64');

      const { text } = await reviewWithOllama(imageBase64, result.name, result.theme);
      const issues = parseReviewResponse(text);

      reviews.push({
        name: result.name,
        theme: result.theme,
        screenshotFile: result.screenshotFile!,
        issues,
        rawResponse: text,
      });

      totalIssues += issues.length;
      const severityCounts = countBy(issues, i => i.severity);
      const severityStr = Object.entries(severityCounts).map(([s, c]) => `${c} ${s}`).join(', ');
      console.log(`  \u2713 [${i + 1}/${toReview.length}] ${result.name} (${result.theme}) \u2014 ${issues.length} issues${issues.length > 0 ? ` (${severityStr})` : ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reviews.push({
        name: result.name,
        theme: result.theme,
        screenshotFile: result.screenshotFile!,
        issues: [],
        rawResponse: '',
        error: msg.slice(0, 300),
      });
      console.log(`  \u2717 [${i + 1}/${toReview.length}] ${result.name} (${result.theme}) \u2014 ERROR: ${msg.slice(0, 80)}`);
    }
  }

  // Generate reports
  const markdownReport = generateMarkdownReport(runId, reviews);
  const mdPath = path.join(runDir, 'vision-review.md');
  fs.writeFileSync(mdPath, markdownReport);

  const allIssues = reviews.flatMap(r => r.issues.map(i => ({ ...i, page: r.name, theme: r.theme })));
  const jsonReport = {
    runId,
    reviewedAt: new Date().toISOString(),
    provider: 'ollama',
    model: OLLAMA_VISION_MODEL,
    summary: {
      screenshotsReviewed: reviews.length,
      totalIssues,
      critical: allIssues.filter(i => i.severity === 'critical').length,
      major: allIssues.filter(i => i.severity === 'major').length,
      minor: allIssues.filter(i => i.severity === 'minor').length,
      info: allIssues.filter(i => i.severity === 'info').length,
      reviewErrors: reviews.filter(r => r.error).length,
    },
    reviews: reviews.map(r => ({
      name: r.name,
      theme: r.theme,
      screenshotFile: r.screenshotFile,
      issues: r.issues,
      error: r.error,
    })),
  };
  const jsonPath = path.join(runDir, 'vision-review.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));

  // Print summary
  const bySev = countBy(allIssues, i => i.severity);
  console.log(`\n${'='.repeat(60)}`);
  console.log('  VISION REVIEW COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Reviewed: ${reviews.length} screenshots`);
  console.log(`  Total issues: ${totalIssues} (${bySev.critical || 0} critical, ${bySev.major || 0} major, ${bySev.minor || 0} minor, ${bySev.info || 0} info)`);
  if (reviews.some(r => r.error)) {
    console.log(`  Review errors: ${reviews.filter(r => r.error).length}`);
  }
  console.log(`\n  Report: ${mdPath}`);
  console.log(`  JSON:   ${jsonPath}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
