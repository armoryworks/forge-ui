/**
 * API Smoke Test
 *
 * Reads all .cs controller files, extracts parameterless GET endpoints,
 * hits each one with an authenticated request, and asserts no 5xx errors.
 *
 * Run: npm run test:api-smoke
 */
import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { getAuthToken, SEED_PASSWORD } from '../../helpers/auth.helper';

const API_BASE = 'http://localhost:5000';
const CONTROLLERS_DIR = path.resolve(
  process.cwd(),
  '../qb-engineer-server/qb-engineer.api/Controllers',
);

interface ParsedEndpoint {
  controller: string;
  method: string;
  url: string;
}

interface SkippedEndpoint {
  controller: string;
  method: string;
  url: string;
  reason: string;
}

interface EndpointResult {
  endpoint: ParsedEndpoint;
  status: number;
  passed: boolean;
  durationMs: number;
}

/**
 * Parse a single controller file and extract all parameterless GET endpoints.
 */
function parseController(filePath: string): { endpoints: ParsedEndpoint[]; skipped: SkippedEndpoint[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const endpoints: ParsedEndpoint[] = [];
  const skipped: SkippedEndpoint[] = [];

  // Extract class-level route: [Route("api/v1/...")]
  const routeMatch = content.match(/\[Route\("([^"]+)"\)\]/);
  if (!routeMatch) {
    return { endpoints, skipped };
  }
  const baseRoute = routeMatch[1];

  // Find all HttpGet attributes with their method names using line-based parsing
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const httpGetMatch = lines[i].match(/\[HttpGet(?:\("([^"]*)"\))?\]/);
    if (!httpGetMatch) continue;

    const routeSuffix = httpGetMatch[1] ?? '';

    // Look ahead up to 5 lines for the method signature
    let methodName: string | null = null;
    for (let j = 0; j <= 5 && i + j < lines.length; j++) {
      const methodMatch = lines[i + j].match(/public\s+(?:async\s+)?(?:\S+\s+)*?(\w+)\s*\(/);
      if (methodMatch) {
        methodName = methodMatch[1];
        break;
      }
    }
    if (!methodName) continue;

    // Build full URL
    let fullUrl: string;
    if (routeSuffix) {
      fullUrl = `/${baseRoute}/${routeSuffix}`;
    } else {
      fullUrl = `/${baseRoute}`;
    }

    // Normalize double slashes
    fullUrl = fullUrl.replace(/\/\//g, '/');

    // Check if the URL contains route parameters like {id}, {id:int}, etc.
    if (/\{[^}]+\}/.test(fullUrl)) {
      skipped.push({
        controller: fileName,
        method: methodName,
        url: fullUrl,
        reason: 'contains route parameter',
      });
      continue;
    }

    endpoints.push({
      controller: fileName,
      method: methodName,
      url: fullUrl,
    });
  }

  return { endpoints, skipped };
}

/**
 * Discover all controllers and parse their GET endpoints.
 */
function discoverEndpoints(): {
  endpoints: ParsedEndpoint[];
  skipped: SkippedEndpoint[];
} {
  const allEndpoints: ParsedEndpoint[] = [];
  const allSkipped: SkippedEndpoint[] = [];

  if (!fs.existsSync(CONTROLLERS_DIR)) {
    throw new Error(`Controllers directory not found: ${CONTROLLERS_DIR}`);
  }

  const files = fs.readdirSync(CONTROLLERS_DIR).filter((f) => f.endsWith('Controller.cs'));

  for (const file of files) {
    const filePath = path.join(CONTROLLERS_DIR, file);
    const { endpoints, skipped } = parseController(filePath);
    allEndpoints.push(...endpoints);
    allSkipped.push(...skipped);
  }

  return { endpoints: allEndpoints, skipped: allSkipped };
}

/**
 * Group items by controller name for readable output.
 */
function groupBy<T extends { controller: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const group = map.get(item.controller) ?? [];
    group.push(item);
    map.set(item.controller, group);
  }
  return map;
}

test.describe('API Smoke Test', () => {
  let token: string;
  let endpoints: ParsedEndpoint[];
  let skipped: SkippedEndpoint[];

  test.beforeAll(async () => {
    // Authenticate
    token = await getAuthToken('admin@qbengineer.local', SEED_PASSWORD);

    // Discover endpoints
    const discovered = discoverEndpoints();
    endpoints = discovered.endpoints;
    skipped = discovered.skipped;

    console.log('\n============================================================');
    console.log('  API SMOKE TEST - Endpoint Discovery');
    console.log('============================================================');
    console.log(`  Controllers scanned: ${new Set(endpoints.map((e) => e.controller)).size}`);
    console.log(`  Parameterless GET endpoints: ${endpoints.length}`);
    console.log(`  Skipped (have route params): ${skipped.length}`);
    console.log('============================================================\n');
  });

  test('all parameterless GET endpoints return non-5xx', async () => {
    expect(endpoints.length).toBeGreaterThan(0);

    const apiContext = await request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    const passed: EndpointResult[] = [];
    const failed: EndpointResult[] = [];

    for (const endpoint of endpoints) {
      const start = Date.now();
      let status: number;

      try {
        const response = await apiContext.get(endpoint.url);
        status = response.status();
      } catch (err: unknown) {
        // Network errors count as failures
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`  NETWORK ERROR: ${endpoint.url} - ${errMsg}`);
        failed.push({
          endpoint,
          status: 0,
          passed: false,
          durationMs: Date.now() - start,
        });
        continue;
      }

      const durationMs = Date.now() - start;
      const is5xx = status >= 500;
      const result: EndpointResult = {
        endpoint,
        status,
        passed: !is5xx,
        durationMs,
      };

      if (is5xx) {
        failed.push(result);
      } else {
        passed.push(result);
      }
    }

    // ── Report: Passed ──
    console.log('\n------------------------------------------------------------');
    console.log(`  PASSED (${passed.length}/${endpoints.length})`);
    console.log('------------------------------------------------------------');
    const passedGrouped = groupBy(passed.map((r) => ({ ...r, controller: r.endpoint.controller })));
    for (const [controller, results] of passedGrouped) {
      console.log(`\n  ${controller}`);
      for (const r of results) {
        const statusTag = r.status < 300 ? `${r.status}` : `${r.status}`;
        console.log(`    ${statusTag}  ${r.endpoint.url}  (${r.durationMs}ms)`);
      }
    }

    // ── Report: Skipped ──
    if (skipped.length > 0) {
      console.log('\n------------------------------------------------------------');
      console.log(`  SKIPPED (${skipped.length}) - endpoints with route parameters`);
      console.log('------------------------------------------------------------');
      const skippedGrouped = groupBy(skipped);
      for (const [controller, items] of skippedGrouped) {
        console.log(`\n  ${controller}`);
        for (const s of items) {
          console.log(`    SKIP  ${s.url}  (${s.reason})`);
        }
      }
    }

    // ── Report: Failed ──
    if (failed.length > 0) {
      console.log('\n------------------------------------------------------------');
      console.log(`  FAILED (${failed.length}) - 5xx server errors`);
      console.log('------------------------------------------------------------');
      const failedGrouped = groupBy(failed.map((r) => ({ ...r, controller: r.endpoint.controller })));
      for (const [controller, results] of failedGrouped) {
        console.log(`\n  ${controller}`);
        for (const r of results) {
          console.log(`    ${r.status}  ${r.endpoint.url}  (${r.durationMs}ms)`);
        }
      }
    }

    // ── Summary ──
    console.log('\n============================================================');
    console.log('  SUMMARY');
    console.log('============================================================');
    console.log(`  Total endpoints:  ${endpoints.length}`);
    console.log(`  Passed:           ${passed.length}`);
    console.log(`  Failed (5xx):     ${failed.length}`);
    console.log(`  Skipped (params): ${skipped.length}`);

    if (passed.length > 0) {
      const avgMs = Math.round(passed.reduce((sum, r) => sum + r.durationMs, 0) / passed.length);
      const maxResult = passed.reduce((a, b) => (a.durationMs > b.durationMs ? a : b));
      console.log(`  Avg response:     ${avgMs}ms`);
      console.log(`  Slowest:          ${maxResult.durationMs}ms  ${maxResult.endpoint.url}`);
    }

    console.log('============================================================\n');

    await apiContext.dispose();

    // Assert no 5xx failures
    if (failed.length > 0) {
      const failList = failed
        .map((f) => `  ${f.status} ${f.endpoint.url} (${f.endpoint.controller})`)
        .join('\n');
      expect(failed.length, `${failed.length} endpoint(s) returned 5xx:\n${failList}`).toBe(0);
    }
  });
});
