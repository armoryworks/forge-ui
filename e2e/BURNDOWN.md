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
| `new-part-save-and-complete:58` empty cost | test asserted wrong behavior — cost is gated at **promote**, not pre-submit (`manualCostOverride` carries only `Validators.min(0)`). Investigating surfaced a **real** form-rehydration **clobber** race: a guard-less `effect()` re-patched the express form from a late/refreshed `entity()` emission, silently overwriting typed input (`emitEvent:false` → no dirty mark) | forge-ui PR #14: pristine-guard the re-hydration effect (`if (!part \|\| form.dirty) return`) + discriminating unit regression; rewrote the test to assert Save **enabled** with empty cost, cost gated server-side at promote |

## Remaining backlog (~7) — NOT clean selector swaps

### A. Workflow UI redesigned (×5) — RESOLVED (forge-ui PR #18)
`workflow-part-assembly-phase5` (×3), `workflow-part-raw-material-phase6`,
`workflow-shell-demo`. Two redesigns: the rail container was renamed
`workflow-rail` → `workflow-steps`, and the part fork moved from a type fork
(`fork-guided`/`fork-express`/`fork-type-Assembly`) to the axis fork
(procurement → inventory-class → mode). raw-material was already on the axis fork
(one stale `workflow-rail`); shell-demo only needed the rail rename; assembly was
retargeted from the retired "Assembly" type to Make + Subassembly
(`part-make-subassembly-v1`, same guided basics→bom→routing→costing shell). The
legacy `part-assembly-guided-v1` definition is no longer startable (`POST
/workflows` 404s), so the promote-gate test asserts the 409 + missing envelope
via the API directly. All 8 cases pass.

### B. Possible real regressions — needs product judgment (don't blindly "fix")
- ~~`new-part-save-and-complete:58`~~ — **RESOLVED (forge-ui PR #14).** Intended
  behavior confirmed: empty cost is *not* blocked pre-submit; it's gated at the
  promote step. Investigating it surfaced and fixed a real form-rehydration
  clobber race (see the fixed table above). Test rewritten to match.
- `validation-popover-triggers` — `app-validation-popover-content` exists but the
  popover doesn't auto-show on field change. Behavioral — confirm the directive's
  auto-show is intended/working.

### C. Environment-sensitive — needs harness work
- `signalr-announcement-pubsub`, `signalr-board-sync` (assertion) — two browsers +
  websocket timing; flaky outside a controlled env.
- `mobile-auto-redirect`, `mobile-workflow` — mobile routing / `/m/` redirect;
  the submit/redirect step fails. Investigate desktop-vs-mobile redirect logic.

### D. Slow serial cluster (×5) — RESOLVED (forge-ui PR #15)
`smoke-data-creation` 2b/2e/2f/2g/2h. Triaged each against the local stack — the
"120s helper timeout" was a misread; `waitForSaveConfirmation` is just a 1.5s
sleep. The per-test 120s budget was being eaten by hanging interactions:
- **2e/2f (expenses)** — pass locally; the nightly failures were the
  resource-starvation flakiness already addressed by the functional/docgen split
  + sharding. No change.
- **2b (job + due date)** — real bug. The `app-datepicker` commits its `Date`
  only on blur/change; the test filled then pressed Escape, leaving uncommitted
  text → parse error → `form.invalid` → `onSubmit()` dropped the create with no
  POST (the screenshot-only test never noticed). Fixed: testid selectors, set
  priority before the date (the calendar overlay was the original hang), blur to
  commit, assert `POST /jobs`.
- **2g/2h (leads)** — `CAP-O2C-LEAD` ships `IsDefaultOn: false`; the SPA's
  capability-gate interceptor short-circuits `POST /leads` client-side, so it
  never hits the network. Made the tests capability-aware (`test.skip` when the
  descriptor reports it disabled) and rewrote the flow for the new two-step fork
  dialog so they pass wherever leads is enabled.
Lesson: the blind `waitForSaveConfirmation` sleep let silent 4xx/5xx + dropped
submits pass as green — replaced with deterministic `POST` assertions.

### E. Content / heuristic
- ~~`discovery-flow-smoke`~~ — **RESOLVED (forge-ui PR #16).** Not just content:
  the wizard gained a top-of-funnel fork **Q-S1** (products/services/both) ahead
  of Q-O*, and Q-O3/Q-O4 became `MultiChoice` (mat-checkboxes, no name/value).
  Rewrote to assert by `data-question-id`, add the Q-S1 step, and pick MultiChoice
  options by label text.
- `smoke/contract-drift` — 16 frontend↔backend mismatches: several are the test's
  own URL-extraction false positives (`{params}`, `{qs}` it can't resolve);
  a few may be real param-pattern mismatches (`accounting/exports/{kind}.csv`,
  `customers/{customerId}/price-lists`). Harden the extractor + audit the real ones.
- ~~`vendor-part-sources-tab` add-vendor flow~~ — **RESOLVED (forge-ui PR #17).**
  The "further issue" was a full redesign, not a selector: add-vendor is now
  editing-mode only (`part-detail-edit-toggle` → `vendor-sources-add` → inline
  `app-entity-picker`), and picking a vendor immediately POSTs `/vendor-parts`
  (the form dialog + PN/lead-time/save step are gone). Rewrote the flow, assert
  the create POST, and pick an unlinked vendor so re-runs stay idempotent.

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
