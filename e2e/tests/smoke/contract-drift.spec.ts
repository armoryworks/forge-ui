/**
 * Contract Drift Detection
 *
 * API-only Playwright test (no browser) that cross-references backend controller
 * routes with frontend service HTTP calls to detect drift.
 *
 * - FAILS if any frontend URL has no matching backend route (broken call).
 * - WARNS (no failure) about backend routes with no frontend caller (orphaned).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────────

function readFilesRecursively(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readFilesRecursively(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Backend route extraction ─────────────────────────────────────────────────

interface BackendRoute {
  method: string;
  pattern: string; // normalized, e.g. "api/v1/jobs/{id}/subtasks"
  file: string;
}

function extractBackendRoutes(controllerDir: string): BackendRoute[] {
  const routes: BackendRoute[] = [];
  const files = readFilesRecursively(controllerDir, '.cs');

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    // Extract class-level [Route("...")]
    const classRouteMatch = content.match(/\[Route\("([^"]+)"\)\]/);
    const classRoute = classRouteMatch ? classRouteMatch[1] : '';

    // Extract all method-level HTTP attributes
    const methodPattern =
      /\[(Http(?:Get|Post|Put|Patch|Delete))(?:\("([^"]*)"\))?\]/g;
    let match: RegExpExecArray | null;

    while ((match = methodPattern.exec(content)) !== null) {
      const httpVerb = match[1].replace('Http', '').toUpperCase();
      const methodRoute = match[2] ?? '';

      // Combine class route + method route
      let fullRoute: string;
      if (classRoute && methodRoute) {
        fullRoute = `${classRoute}/${methodRoute}`;
      } else if (classRoute) {
        fullRoute = classRoute;
      } else {
        fullRoute = methodRoute;
      }

      // Normalize: strip constraint suffixes like :int, :guid, etc.
      fullRoute = fullRoute.replace(/\{(\w+):\w+\}/g, '{$1}');
      // Remove double slashes
      fullRoute = fullRoute.replace(/\/\//g, '/');
      // Strip trailing slash
      fullRoute = fullRoute.replace(/\/$/, '');

      if (fullRoute) {
        routes.push({ method: httpVerb, pattern: fullRoute, file: fileName });
      }
    }
  }

  return routes;
}

// ── Frontend URL extraction ──────────────────────────────────────────────────

interface FrontendUrl {
  pattern: string; // normalized base path, e.g. "api/v1/jobs/{id}/subtasks"
  raw: string; // original matched string
  file: string;
}

/**
 * Resolve a URL string that may reference a base field.
 * E.g. `${this.baseUrl}/rooms` with baseDefs { baseUrl: 'chat' } -> 'api/v1/chat/rooms'
 */
function resolveUrl(
  raw: string,
  baseDefs: Record<string, string>,
): string | null {
  let url = raw;

  // Resolve base field references: ${this.fieldName} or ${this.fieldName}
  for (const [field, basePath] of Object.entries(baseDefs)) {
    const patterns = [
      `\${this.${field}}`,
      `\${${field}}`,
    ];
    for (const pattern of patterns) {
      if (url.includes(pattern)) {
        url = url.replace(pattern, `api/v1/${basePath}`);
      }
    }
  }

  // Handle ${environment.apiUrl} prefix
  url = url.replace(/\$\{environment\.apiUrl\}\/?/g, 'api/v1/');
  url = url.replace(/\$\{this\.apiUrl\}\/?/g, 'api/v1/');

  // Strip leading protocol + host (e.g. http://localhost:5000)
  url = url.replace(/^https?:\/\/[^/]+/, '');

  // Strip leading slash
  url = url.replace(/^\//, '');

  // Handle remaining ${...} interpolations — replace with {param}
  url = url.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    if (/^\w+$/.test(expr)) return `{${expr}}`;
    const lastPart = expr.split('.').pop() ?? 'param';
    if (lastPart.includes('(')) return '{param}';
    return `{${lastPart}}`;
  });

  // Must start with api/v1
  if (!url.startsWith('api/v1')) return null;

  // Strip query params
  url = url.split('?')[0];

  // Strip trailing slash
  url = url.replace(/\/$/, '');

  // Collapse double slashes
  url = url.replace(/\/\//g, '/');

  return url;
}

function extractFrontendUrls(dirs: string[]): FrontendUrl[] {
  const urls: FrontendUrl[] = [];
  const seen = new Set<string>();
  const baseDir = dirs[0];

  for (const dir of dirs) {
    const files = readFilesRecursively(dir, '.ts');
    for (const filePath of files) {
      const baseName = path.basename(filePath);
      // Only scan service files
      if (!baseName.endsWith('.service.ts')) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const relFile = path.relative(baseDir, filePath).replace(/\\/g, '/');

      // Step 1: Extract base URL field definitions
      // e.g. private readonly base = `${environment.apiUrl}/ai`;
      // e.g. private readonly baseUrl = '/api/v1/spc';
      const baseDefs: Record<string, string> = {};

      // Pattern: field = `${environment.apiUrl}/path`
      const baseDefPattern1 =
        /(?:private\s+)?(?:readonly\s+)?(\w+)\s*=\s*`\$\{environment\.apiUrl\}\/([^`]+)`/g;
      let m: RegExpExecArray | null;
      while ((m = baseDefPattern1.exec(content)) !== null) {
        baseDefs[m[1]] = m[2];
      }

      // Pattern: field = '/api/v1/path'  or  field = "/api/v1/path"
      const baseDefPattern2 =
        /(?:private\s+)?(?:readonly\s+)?(\w+)\s*=\s*['"]\/api\/v1\/([^'"]+)['"]/g;
      while ((m = baseDefPattern2.exec(content)) !== null) {
        baseDefs[m[1]] = m[2];
      }

      // Step 2: Find all HTTP call sites
      // Match: this.http.get(URL), this.http.post(URL, ...), etc.
      // Also match: window.location.href = URL
      const httpCallPattern =
        /(?:this\.http\.(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*|window\.location\.href\s*=\s*)(["'`])([^"'`]*?)\1/g;

      while ((m = httpCallPattern.exec(content)) !== null) {
        const raw = m[2];
        const normalized = resolveUrl(raw, baseDefs);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          urls.push({ pattern: normalized, raw, file: relFile });
        }
      }

      // Step 3: Handle template literal HTTP calls with interpolation
      // Match: this.http.get(`...${...}...`)
      // We need a different regex because backtick strings with ${} can't be
      // captured by the simple pattern above
      const templateCallPattern =
        /(?:this\.http\.(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*|window\.location\.href\s*=\s*)`([^`]+)`/g;

      while ((m = templateCallPattern.exec(content)) !== null) {
        const raw = m[1];
        const normalized = resolveUrl(raw, baseDefs);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          urls.push({ pattern: normalized, raw, file: relFile });
        }
      }
    }
  }

  return urls;
}

// ── Matching logic ───────────────────────────────────────────────────────────

/**
 * Convert a route pattern to a regex for matching.
 * {anything} matches one or more path segments (greedy for ** patterns, single for others).
 */
function routeToRegex(pattern: string): RegExp {
  const escaped = pattern
    .split('/')
    .map((seg) => {
      if (seg === '{**key}' || seg === '{*key}') return '.+';
      if (seg.startsWith('{') && seg.endsWith('}')) return '[^/]+';
      return escapeRegExp(seg);
    })
    .join('/');
  return new RegExp(`^${escaped}$`);
}

/**
 * Check if a frontend URL pattern matches any backend route.
 */
function matchesAnyRoute(
  frontendPattern: string,
  backendRoutes: BackendRoute[],
): boolean {
  for (const route of backendRoutes) {
    // Direct equality
    if (route.pattern === frontendPattern) return true;
    // Backend route as regex, test against frontend
    if (routeToRegex(route.pattern).test(frontendPattern)) return true;
    // Frontend as regex, test against backend
    if (routeToRegex(frontendPattern).test(route.pattern)) return true;
  }
  return false;
}

/**
 * Check if a backend route matches any frontend URL.
 */
function matchesAnyFrontend(
  backendRoute: BackendRoute,
  frontendUrls: FrontendUrl[],
): boolean {
  for (const url of frontendUrls) {
    if (url.pattern === backendRoute.pattern) return true;
    if (routeToRegex(backendRoute.pattern).test(url.pattern)) return true;
    if (routeToRegex(url.pattern).test(backendRoute.pattern)) return true;
  }
  return false;
}

// ── Test ─────────────────────────────────────────────────────────────────────

test.describe('Contract Drift Detection', () => {
  test('frontend API URLs must match backend routes', () => {
    // process.cwd() = qb-engineer-ui -> up 1 level to qb-engineer-wrapper
    const rootDir = path.resolve(process.cwd(), '..');
    const controllerDir = path.join(
      rootDir,
      'qb-engineer-server',
      'qb-engineer.api',
      'Controllers',
    );
    const featureDir = path.join(
      rootDir,
      'qb-engineer-ui',
      'src',
      'app',
      'features',
    );
    const sharedServicesDir = path.join(
      rootDir,
      'qb-engineer-ui',
      'src',
      'app',
      'shared',
      'services',
    );

    // Verify directories exist
    if (!fs.existsSync(controllerDir)) {
      throw new Error(`Controller directory not found: ${controllerDir}`);
    }
    if (!fs.existsSync(featureDir)) {
      throw new Error(`Feature directory not found: ${featureDir}`);
    }

    // Extract routes and URLs
    const backendRoutes = extractBackendRoutes(controllerDir);
    const frontendUrls = extractFrontendUrls([featureDir, sharedServicesDir]);

    // Deduplicate backend routes by method+pattern
    const uniqueBackendPatterns = new Map<string, BackendRoute>();
    for (const route of backendRoutes) {
      const key = `${route.method} ${route.pattern}`;
      if (!uniqueBackendPatterns.has(key)) {
        uniqueBackendPatterns.set(key, route);
      }
    }

    // Cross-reference: frontend URLs with no backend match
    const driftUrls: FrontendUrl[] = [];
    const matchedFrontend: FrontendUrl[] = [];
    for (const url of frontendUrls) {
      if (matchesAnyRoute(url.pattern, backendRoutes)) {
        matchedFrontend.push(url);
      } else {
        driftUrls.push(url);
      }
    }

    // Cross-reference: backend routes with no frontend caller
    const orphanedRoutes: BackendRoute[] = [];
    const matchedBackend: BackendRoute[] = [];
    for (const route of uniqueBackendPatterns.values()) {
      if (matchesAnyFrontend(route, frontendUrls)) {
        matchedBackend.push(route);
      } else {
        orphanedRoutes.push(route);
      }
    }

    // ── Report ───────────────────────────────────────────────────────────

    console.log('\n');
    console.log('='.repeat(80));
    console.log('  CONTRACT DRIFT DETECTION REPORT');
    console.log('='.repeat(80));

    console.log(`\n  Backend routes extracted:  ${uniqueBackendPatterns.size}`);
    console.log(`  Frontend URLs extracted:   ${frontendUrls.length}`);
    console.log(`  Matched (both sides):      ${matchedFrontend.length}`);
    console.log(`  Frontend drift (FAIL):     ${driftUrls.length}`);
    console.log(`  Backend orphaned (WARN):   ${orphanedRoutes.length}`);

    if (driftUrls.length > 0) {
      console.log('\n' + '-'.repeat(80));
      console.log(
        '  DRIFT: Frontend URLs with NO matching backend route',
      );
      console.log('-'.repeat(80));
      for (const url of driftUrls) {
        console.log(`  [DRIFT]  ${url.pattern}`);
        console.log(`           raw: ${url.raw}`);
        console.log(`           file: ${url.file}`);
      }
    }

    if (orphanedRoutes.length > 0) {
      console.log('\n' + '-'.repeat(80));
      console.log(
        '  WARN: Backend routes with NO frontend caller (possibly OK)',
      );
      console.log('-'.repeat(80));
      for (const route of orphanedRoutes) {
        console.log(
          `  [ORPHAN] ${route.method.padEnd(7)} ${route.pattern}`,
        );
        console.log(`           file: ${route.file}`);
      }
    }

    if (driftUrls.length === 0 && orphanedRoutes.length === 0) {
      console.log(
        '\n  All frontend URLs matched. No orphaned backend routes.',
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('');

    // FAIL only on drift (frontend URLs with no backend match)
    expect(
      driftUrls.length,
      `${driftUrls.length} frontend API URL(s) have no matching backend route:\n` +
        driftUrls
          .map((u) => `  ${u.pattern}  (${u.file})`)
          .join('\n'),
    ).toBe(0);
  });
});
