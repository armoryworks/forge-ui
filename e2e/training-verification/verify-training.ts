/**
 * Training Content Verification Tool
 *
 * Reads training modules from the API, screenshots each module's page(s),
 * sends both to a vision model, and produces a discrepancy report.
 *
 * With --fix flag: auto-fixes seed data files and recursively re-verifies
 * (max 3 iterations).
 *
 * Usage:
 *   npx tsx e2e/training-verification/verify-training.ts
 *   npx tsx e2e/training-verification/verify-training.ts --fix
 *
 * Environment:
 *   ANTHROPIC_API_KEY  — use Claude for review (recommended)
 *   OLLAMA_URL         — Ollama endpoint (default: http://localhost:11434)
 *   OLLAMA_VISION_MODEL — Ollama model (default: llava:7b)
 *   SEED_USER_PASSWORD — login password (default: Test1234!)
 *   API_BASE_URL       — API base (default: http://localhost:5000/api/v1/)
 *   APP_BASE_URL       — App base (default: http://localhost:4200)
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Page, type Browser } from 'playwright';

// ── Config ──

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/v1/';
const APP_BASE = process.env.APP_BASE_URL || 'http://localhost:4200';
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD || 'Test1234!';
const ADMIN_EMAIL = 'admin@qbengineer.local';
const FIX_MODE = process.argv.includes('--fix');
const MAX_ITERATIONS = 3;

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava:7b';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ── Types ──

interface TrainingModule {
  id: number;
  title: string;
  slug: string;
  contentType: string;
  contentJson: string;
  appRoutes: string;
  tags: string;
  isPublished: boolean;
}

interface Discrepancy {
  severity: 'critical' | 'major' | 'minor';
  type: 'missing_element' | 'wrong_label' | 'wrong_location' | 'missing_coverage' | 'wrong_description';
  trainingText: string;
  actualUi: string;
  suggestedFix: string;
  location: string;
}

interface ModuleVerification {
  moduleSlug: string;
  moduleTitle: string;
  route: string;
  issuesFound: number;
  discrepancies: Discrepancy[];
  screenshotFile: string;
  error?: string;
}

interface IterationResult {
  iteration: number;
  timestamp: string;
  totalModules: number;
  modulesVerified: number;
  totalIssues: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  modules: ModuleVerification[];
}

// ── Vision Model Providers ──

const VERIFICATION_PROMPT = `You are verifying training documentation against a live UI screenshot for a manufacturing ERP called QB Engineer.

Compare the training content against what you see in the screenshot. Report discrepancies:

1. **Missing elements** — training mentions a button/field/section that doesn't exist in the UI
2. **Wrong labels** — training says "Save" but UI shows "Submit"
3. **Wrong locations** — training says "top-right" but element is "bottom-left"
4. **Missing coverage** — UI has visible elements/sections not mentioned in training
5. **Wrong descriptions** — training describes behavior that doesn't match visible UI state

IMPORTANT: Only report actual discrepancies you can verify from the screenshot.
Do NOT flag things you cannot see (like hidden dialogs, hover states, or behavior).
Focus on what IS visible: page layout, buttons, labels, tables, filters, headers.

Return ONLY this JSON (no markdown, no explanation):
{"moduleSlug":"...","route":"...","issuesFound":0,"discrepancies":[{"severity":"critical|major|minor","type":"missing_element|wrong_label|wrong_location|missing_coverage|wrong_description","trainingText":"what the training says","actualUi":"what the screenshot shows","suggestedFix":"corrected text","location":"which part of the content to fix"}]}

If no discrepancies: {"moduleSlug":"...","route":"...","issuesFound":0,"discrepancies":[]}`;

async function reviewWithClaude(imageBase64: string, moduleContent: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
          { type: 'text', text: `${VERIFICATION_PROMPT}\n\nTRAINING CONTENT:\n${moduleContent}` },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${err}`);
  }

  const data = await response.json() as { content: { type: string; text: string }[] };
  const textBlock = data.content.find(b => b.type === 'text');
  return textBlock?.text || '{}';
}

async function reviewWithOllama(imageBase64: string, moduleContent: string): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_VISION_MODEL,
      prompt: `${VERIFICATION_PROMPT}\n\nTRAINING CONTENT:\n${moduleContent}`,
      stream: false,
      images: [imageBase64],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { response: string };
  return data.response;
}

async function reviewScreenshot(imageBase64: string, moduleContent: string): Promise<string> {
  if (ANTHROPIC_API_KEY) {
    return reviewWithClaude(imageBase64, moduleContent);
  }
  return reviewWithOllama(imageBase64, moduleContent);
}

// ── Response Parsing ──

function parseVerificationResponse(raw: string, slug: string, route: string): ModuleVerification {
  const fallback: ModuleVerification = {
    moduleSlug: slug,
    moduleTitle: '',
    route,
    issuesFound: 0,
    discrepancies: [],
    screenshotFile: '',
  };

  const jsonStr = extractJson(raw);
  if (!jsonStr) return { ...fallback, error: `Unparseable response: ${raw.slice(0, 300)}` };

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      moduleSlug: parsed.moduleSlug || slug,
      moduleTitle: '',
      route: parsed.route || route,
      issuesFound: parsed.issuesFound || 0,
      discrepancies: validateDiscrepancies(parsed.discrepancies || []),
      screenshotFile: '',
    };
  } catch {
    return { ...fallback, error: `JSON parse error: ${raw.slice(0, 300)}` };
  }
}

function extractJson(raw: string): string | null {
  try { JSON.parse(raw); return raw; } catch { /* continue */ }

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { JSON.parse(fence[1].trim()); return fence[1].trim(); } catch { /* continue */ } }

  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) { try { JSON.parse(brace[0]); return brace[0]; } catch { /* continue */ } }

  return null;
}

function validateDiscrepancies(items: unknown[]): Discrepancy[] {
  const validSeverities = new Set(['critical', 'major', 'minor']);
  const validTypes = new Set(['missing_element', 'wrong_label', 'wrong_location', 'missing_coverage', 'wrong_description']);

  return items
    .filter((i): i is Record<string, string> => typeof i === 'object' && i !== null)
    .map(i => ({
      severity: (validSeverities.has(i.severity) ? i.severity : 'minor') as Discrepancy['severity'],
      type: (validTypes.has(i.type) ? i.type : 'wrong_description') as Discrepancy['type'],
      trainingText: String(i.trainingText || ''),
      actualUi: String(i.actualUi || ''),
      suggestedFix: String(i.suggestedFix || ''),
      location: String(i.location || ''),
    }));
}

// ── Auth ──

async function login(page: Page): Promise<void> {
  const response = await fetch(`${API_BASE}auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: SEED_PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { token: string; user: Record<string, unknown> };

  await page.goto(APP_BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((loginData) => {
    localStorage.setItem('auth_token', loginData.token);
    localStorage.setItem('user', JSON.stringify(loginData.user));
  }, data);
}

// ── Fetch Training Modules ──

async function fetchModules(): Promise<TrainingModule[]> {
  const loginResp = await fetch(`${API_BASE}auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: SEED_PASSWORD }),
  });

  if (!loginResp.ok) throw new Error(`Login failed: ${loginResp.status}`);
  const { token } = await loginResp.json() as { token: string };

  const modulesResp = await fetch(`${API_BASE}training/modules?pageSize=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!modulesResp.ok) throw new Error(`Fetch modules failed: ${modulesResp.status}`);
  const body = await modulesResp.json() as { data: TrainingModule[] };
  return body.data;
}

// ── Screenshot Capture ──

async function captureRoute(page: Page, route: string, outputPath: string): Promise<void> {
  await page.goto(`${APP_BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500); // let animations settle
  await page.screenshot({ path: outputPath, fullPage: false });
}

// ── Auto-Fix ──

function applyFixes(discrepancies: Discrepancy[], moduleSlug: string): number {
  // Map slug to seed file
  const featureMap: Record<string, string> = {};
  const seedDir = path.resolve(__dirname, '../../..', 'qb-engineer-server/qb-engineer.api/Data/TrainingContent');

  if (!fs.existsSync(seedDir)) {
    console.warn(`  Seed directory not found: ${seedDir}`);
    return 0;
  }

  const files = fs.readdirSync(seedDir).filter(f => f.endsWith('Training.cs'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(seedDir, file), 'utf-8');
    if (content.includes(`"${moduleSlug}"`)) {
      featureMap[moduleSlug] = path.join(seedDir, file);
    }
  }

  const seedFile = featureMap[moduleSlug];
  if (!seedFile) {
    console.warn(`  No seed file found for slug: ${moduleSlug}`);
    return 0;
  }

  let fileContent = fs.readFileSync(seedFile, 'utf-8');
  let fixCount = 0;

  for (const d of discrepancies) {
    if (!d.suggestedFix || !d.trainingText) continue;
    if (d.trainingText.length < 5) continue; // skip tiny matches

    const escaped = d.trainingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const newContent = fileContent.replace(regex, d.suggestedFix);

    if (newContent !== fileContent) {
      fileContent = newContent;
      fixCount++;
      console.log(`  Fixed: "${d.trainingText.slice(0, 60)}..." → "${d.suggestedFix.slice(0, 60)}..."`);
    }
  }

  if (fixCount > 0) {
    fs.writeFileSync(seedFile, fileContent, 'utf-8');
  }

  return fixCount;
}

// ── Report Generation ──

function generateReport(results: IterationResult[]): string {
  const latest = results[results.length - 1];
  const lines: string[] = [
    '# Training Content Verification Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Provider:** ${ANTHROPIC_API_KEY ? 'Claude (claude-sonnet-4-20250514)' : `Ollama (${OLLAMA_VISION_MODEL})`}`,
    `**Iterations:** ${results.length}`,
    `**Fix Mode:** ${FIX_MODE ? 'ON' : 'OFF'}`,
    '',
    '## Summary',
    '',
    `| Iteration | Modules | Issues | Critical | Major | Minor |`,
    `|-----------|---------|--------|----------|-------|-------|`,
  ];

  for (const r of results) {
    lines.push(`| ${r.iteration} | ${r.modulesVerified} | ${r.totalIssues} | ${r.criticalIssues} | ${r.majorIssues} | ${r.minorIssues} |`);
  }

  lines.push('', '## Latest Results', '');

  for (const mod of latest.modules) {
    if (mod.issuesFound === 0 && !mod.error) continue;

    lines.push(`### ${mod.moduleTitle || mod.moduleSlug} (${mod.route})`);
    if (mod.error) {
      lines.push(`**Error:** ${mod.error}`, '');
      continue;
    }

    for (const d of mod.discrepancies) {
      lines.push(`- **[${d.severity.toUpperCase()}]** ${d.type}: ${d.trainingText.slice(0, 100)}`);
      lines.push(`  - Actual UI: ${d.actualUi}`);
      if (d.suggestedFix) lines.push(`  - Suggested: ${d.suggestedFix}`);
    }
    lines.push('');
  }

  const cleanCount = latest.modules.filter(m => m.issuesFound === 0 && !m.error).length;
  lines.push(`---`, ``, `**${cleanCount}/${latest.modulesVerified} modules verified clean.**`);

  return lines.join('\n');
}

// ── Main ──

async function runVerification(browser: Browser, page: Page, modules: TrainingModule[], outputDir: string): Promise<IterationResult> {
  const screenshotsDir = path.join(outputDir, 'screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const results: ModuleVerification[] = [];
  const modulesWithRoutes = modules.filter(m => {
    try {
      const routes = JSON.parse(m.appRoutes || '[]') as string[];
      return routes.length > 0;
    } catch { return false; }
  });

  console.log(`  Verifying ${modulesWithRoutes.length} modules with routes...`);

  for (const mod of modulesWithRoutes) {
    const routes = JSON.parse(mod.appRoutes) as string[];
    const route = routes[0]; // use primary route

    // Skip /training route (it's the training page itself, not a feature)
    if (route === '/training') continue;

    const screenshotFile = path.join(screenshotsDir, `${mod.slug}.png`);

    try {
      console.log(`  [${mod.slug}] Capturing ${route}...`);
      await captureRoute(page, route, screenshotFile);

      const imageBase64 = fs.readFileSync(screenshotFile).toString('base64');
      const contentSummary = `Module: ${mod.title}\nSlug: ${mod.slug}\nType: ${mod.contentType}\nContent: ${mod.contentJson.slice(0, 3000)}`;

      console.log(`  [${mod.slug}] Reviewing with vision model...`);
      const raw = await reviewScreenshot(imageBase64, contentSummary);
      const verification = parseVerificationResponse(raw, mod.slug, route);
      verification.moduleTitle = mod.title;
      verification.screenshotFile = screenshotFile;

      results.push(verification);
      console.log(`  [${mod.slug}] ${verification.issuesFound} issues found`);
    } catch (err) {
      results.push({
        moduleSlug: mod.slug,
        moduleTitle: mod.title,
        route,
        issuesFound: 0,
        discrepancies: [],
        screenshotFile,
        error: String(err),
      });
      console.error(`  [${mod.slug}] Error: ${err}`);
    }
  }

  const iteration: IterationResult = {
    iteration: 0,
    timestamp: new Date().toISOString(),
    totalModules: modules.length,
    modulesVerified: results.length,
    totalIssues: results.reduce((sum, r) => sum + r.issuesFound, 0),
    criticalIssues: results.reduce((sum, r) => sum + r.discrepancies.filter(d => d.severity === 'critical').length, 0),
    majorIssues: results.reduce((sum, r) => sum + r.discrepancies.filter(d => d.severity === 'major').length, 0),
    minorIssues: results.reduce((sum, r) => sum + r.discrepancies.filter(d => d.severity === 'minor').length, 0),
    modules: results,
  };

  return iteration;
}

async function main(): Promise<void> {
  console.log('Training Content Verification Tool');
  console.log(`Provider: ${ANTHROPIC_API_KEY ? 'Claude' : 'Ollama'}`);
  console.log(`Fix mode: ${FIX_MODE ? 'ON' : 'OFF'}`);
  console.log('');

  // Setup output directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.resolve(__dirname, 'results', timestamp);
  fs.mkdirSync(outputDir, { recursive: true });

  // Fetch modules
  console.log('Fetching training modules from API...');
  const modules = await fetchModules();
  console.log(`Found ${modules.length} modules`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await login(page);

  const allIterations: IterationResult[] = [];
  const maxIterations = FIX_MODE ? MAX_ITERATIONS : 1;

  for (let i = 1; i <= maxIterations; i++) {
    console.log(`\n═══ Iteration ${i}/${maxIterations} ═══`);

    const result = await runVerification(browser, page, modules, outputDir);
    result.iteration = i;
    allIterations.push(result);

    // Save iteration result
    fs.writeFileSync(
      path.join(outputDir, `iteration-${i}.json`),
      JSON.stringify(result, null, 2),
    );

    console.log(`\n  Results: ${result.totalIssues} issues (${result.criticalIssues} critical, ${result.majorIssues} major, ${result.minorIssues} minor)`);

    // If no issues or not in fix mode, stop
    if (result.totalIssues === 0) {
      console.log('  All modules verified clean!');
      break;
    }

    if (!FIX_MODE) break;

    // Check convergence
    if (i > 1) {
      const prev = allIterations[i - 2];
      if (result.totalIssues >= prev.totalIssues) {
        console.log('  Issue count did not decrease — stopping (convergence failure).');
        break;
      }
    }

    // Apply fixes
    if (i < maxIterations) {
      console.log('\n  Applying auto-fixes...');
      let totalFixes = 0;
      for (const mod of result.modules) {
        if (mod.discrepancies.length > 0) {
          const fixes = applyFixes(mod.discrepancies, mod.moduleSlug);
          totalFixes += fixes;
        }
      }
      console.log(`  Applied ${totalFixes} fixes. Re-verifying...`);

      if (totalFixes === 0) {
        console.log('  No fixable discrepancies found — stopping.');
        break;
      }
    }
  }

  await browser.close();

  // Generate reports
  const markdownReport = generateReport(allIterations);
  fs.writeFileSync(path.join(outputDir, 'verification-report.md'), markdownReport);
  fs.writeFileSync(path.join(outputDir, 'verification-report.json'), JSON.stringify(allIterations, null, 2));

  console.log(`\nReport saved to: ${outputDir}/verification-report.md`);
  console.log(`JSON saved to: ${outputDir}/verification-report.json`);

  const latest = allIterations[allIterations.length - 1];
  const cleanCount = latest.modules.filter(m => m.issuesFound === 0 && !m.error).length;
  console.log(`\nFinal: ${cleanCount}/${latest.modulesVerified} modules verified clean.`);

  if (latest.totalIssues > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
