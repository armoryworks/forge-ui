# Nightly E2E burn-down

The Nightly E2E suite had **never passed** (0/34 from its inception on 2026-05-13).
Root cause was twofold and is now diagnosed:

1. **Resource starvation** on `ubuntu-latest` (2 vCPU / 7 GB): the full Docker
   stack + Chromium + 185 serial tests over ~50 min exceeded the runner. ~12/13
   sampled "CI failures" pass cleanly on a 22 GB box.
2. **A month of accumulated test drift** (renamed components, the paged-envelope
   standardization, strict-mode selector bugs, stale content/feature assertions),
   which hid **one genuine production bug** (storage-usage 500).

## Structural fixes — DONE (merged)
- **Sharding** (4-way) — `nightly.yml`. ~2× faster, less cumulative degradation.
- **Functional / doc-gen split** — `playwright.config.ts`. The **functional**
  project (99 tests) is the green gate, sharded. The **docgen** project (86
  screenshot/doc-generation tests) is a separate `continue-on-error` job that
  produces artifacts but can't redden the nightly.

## Functional gate — fixed (merged)
| Test(s) | Root cause | Fix |
|---|---|---|
| storage-usage 500 (`api-smoke`) | **Real bug** — EF GroupBy→ctor→OrderBy untranslatable | forge-api: aggregate in SQL, order/project client-side (+ Postgres regression test). Deployed in `0.0.304`. |
| `INV-SO2` | line editing now allowed; "no edit endpoint" obsolete | assert Draft lines are editable, restore the shared probe SO |
| `job-detail-ux` ×7 | activity tabs refactored into `app-entity-activity-section` | remap `.jd-*`/`.comment-list`/`.note-item` → `data-testid` / `ea-*` |
| `critical-flows` kanban | columns are `app-board-column` | selector swap |
| `critical-flows` create-job | `app-dialog, app-job-dialog` → 2 elements (strict mode); backlog doesn't surface new jobs | wait on title input; verify via POST-response id |
| `part-detail-tabs` Sources | `app-vendor-part-list-panel` → `app-vendor-sources-panel` | selector swap |
| `signalr-board-sync` setup | `GET /jobs` now paged `{items}` | read `.items` |

## Remaining backlog (~20) — NOT clean selector swaps

### A. Workflow UI redesigned (×5) — needs flow rewrite
`workflow-part-assembly-phase5` (×3), `workflow-part-raw-material-phase6`,
`workflow-shell-demo`. The tests use `data-testid="fork-guided"` and
`"workflow-rail"`, which **no longer exist** (0 occurrences in `src`). The
current workflow shell (`part-workflow-page`) exposes a different flow:
`fork-item-kind`, `fork-continue`, `customer-workflow-shell`, `express-*`.
**Action:** rewrite the interaction flow against the current workflow UX (needs
someone familiar with the redesigned part-workflow shell). Not a 1:1 remap.

### B. Possible real regressions — needs product judgment (don't blindly "fix")
- `new-part-save-and-complete:58` — expects `[data-testid="express-save-btn"]`
  **disabled** when cost is empty (pre-submit invalid). It's **enabled**. Either
  validation moved to submit-time (update the test) or empty cost is no longer
  blocked (**real bug**). Confirm intended behavior before changing the test.
- `validation-popover-triggers` — `app-validation-popover-content` exists but the
  popover doesn't auto-show on field change. Behavioral — confirm the directive's
  auto-show is intended/working.

### C. Environment-sensitive — needs harness work
- `signalr-announcement-pubsub`, `signalr-board-sync` (assertion) — two browsers +
  websocket timing; flaky outside a controlled env.
- `mobile-auto-redirect`, `mobile-workflow` — mobile routing / `/m/` redirect;
  the submit/redirect step fails. Investigate desktop-vs-mobile redirect logic.

### D. Slow serial cluster (×5) — needs helper review
`smoke-data-creation` 2b/2e/2f/2g/2h (create job/expense/lead). Serial, 120s
timeouts via the shared `waitForSaveConfirmation` helper. Likely the same
"list doesn't live-refresh after create" pattern as create-job; verify via the
create API response instead.

### E. Content / heuristic
- `discovery-flow-smoke` — asserts the first wizard question contains `"Q-O1"`;
  content changed. Update to the current first-question id/text.
- `smoke/contract-drift` — 16 frontend↔backend mismatches: several are the test's
  own URL-extraction false positives (`{params}`, `{qs}` it can't resolve);
  a few may be real param-pattern mismatches (`accounting/exports/{kind}.csv`,
  `customers/{customerId}/price-lists`). Harden the extractor + audit the real ones.
- `vendor-part-sources-tab` add-vendor flow — selector fixed; the add-vendor
  interaction has a further issue to chase.

## How to reproduce locally
The bundled Chromium doesn't support very new host OSes; point Playwright at a
system Chrome and keep the project split:
```ts
// e2e/playwright.local.config.ts (gitignored)
import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base, globalTimeout: undefined,
  projects: (base.projects ?? []).map((p) => ({ ...p, use: { ...p.use, channel: 'chrome' } })),
});
```
Bring up the stack, then run a project:
```
docker compose -f ../forge-deploy/compose-e2e.yml up -d --wait
npx playwright test --config=e2e/playwright.local.config.ts --project=functional <spec>
```
