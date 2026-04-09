# E2E Test Scenarios

Interactive Playwright scenarios that drive the real UI to build up
realistic data, then **pause for you to manually test** key actions.

## Scenario Tree

Scenarios form a tree — some stack (run sequentially), some are
mutually exclusive (different branches from the same base).

```
Fresh DB (reset-db.sh)
│
├── 00-qb-cleanup ── clean QB sandbox before integration tests
│
└── 01-foundation ── creates parts, vendors, customers, bins
    │
    ├── 02a-onboarding ── admin creates employee
    │   │  ⏸ YOU: complete employee self-registration
    │   │  ⏸ YOU: set PIN for kiosk auth
    │   │
    │   └── 03a-kiosk ── opens shop floor display
    │       ⏸ YOU: scan badge / enter barcode
    │       ⏸ YOU: clock in via kiosk
    │       automation creates assigned tasks
    │       ⏸ YOU: view tasks, clock out
    │
    ├── 02b-orders ── creates quotes with line items
    │   │  ⏸ YOU: review quote, edit lines, send to customer
    │   │  ⏸ YOU: accept quote, convert to sales order
    │   │  automation creates POs from SO materials
    │   │  ⏸ YOU: receive PO delivery (scanner test)
    │   │
    │   └── 03b-fulfillment ── moves SO to ready-to-ship
    │       ⏸ YOU: create shipment, enter tracking
    │       ⏸ YOU: create invoice from shipment
    │       ⏸ YOU: generate invoice PDF
    │       ⏸ YOU: record payment against invoice
    │
    ├── 02c-production ── creates jobs on kanban board
    │   │  ⏸ YOU: drag jobs between stages
    │   │  ⏸ YOU: assign jobs to engineers
    │   │  ⏸ YOU: start/stop timer on a job
    │   │
    │   ├── 03c-quality ── creates QC templates + assets
    │   │   ⏸ YOU: create inspection from template
    │   │   ⏸ YOU: record pass/fail results
    │   │   ⏸ YOU: scan part for inspection lookup
    │   │
    │   └── 03d-expenses ── engineer submits expenses
    │       ⏸ YOU: submit an expense with receipt
    │       automation logs in as manager
    │       ⏸ YOU: approve/reject expenses in queue
    │
    ├── 02d-full-populate ── NON-INTERACTIVE
    │   runs all branches without pauses
    │   creates maximum data for dashboard/reports testing
    │
    └── 02e-qb-sandbox ── QB integration tests (requires sandbox)
        ⏸ YOU: connect QB sandbox via OAuth
        automation creates customers + invoices
        ⏸ YOU: verify sync in QB sandbox portal
        ⏸ YOU: record payment, verify sync
        ⏸ YOU: test irreversible stage enforcement
        ⏸ YOU: disconnect QB, verify standalone mode
```

## Usage

```bash
# 1. Reset DB to fresh seed state
./e2e/scenarios/reset-db.sh

# 2. Run a scenario path (MUST use headed mode for interactive)
npm run scenario:onboarding     # 01 → 02a → 03a (employee + kiosk)
npm run scenario:orders         # 01 → 02b → 03b (quote-to-cash)
npm run scenario:production     # 01 → 02c → 03c (kanban + QC)
npm run scenario:expenses       # 01 → 02c → 03d (kanban + expense approval)
npm run scenario:populate       # 01 → 02d (headless, non-interactive)

# 3. QuickBooks sandbox testing
npm run scenario:qb-clean       # Clean sandbox only
npm run scenario:qb-sandbox     # 01 → 02e (QB integration)
npm run scenario:qb-fresh       # 00 → 01 → 02e (full clean + QB)
```

## QB Sandbox Setup

For QuickBooks integration testing:

1. **Intuit Developer Portal**: https://developer.intuit.com
2. **Sandbox companies** are free — no billing on sandbox
3. **Reset sandbox**: Developer Portal → Dashboard → App → Sandbox → "Reset"
4. **Multiple sandboxes**: Create separate companies per test path
5. **API mode**: Must set `MOCK_INTEGRATIONS=false` before running

```bash
# Switch to real QB mode
MOCK_INTEGRATIONS=false docker compose up -d --build qb-engineer-api

# Switch back to mock mode
MOCK_INTEGRATIONS=true docker compose up -d --build qb-engineer-api
```

## How Interactive Pauses Work

At each ⏸ checkpoint, the scenario:
1. Prints instructions to the terminal
2. Calls `page.pause()` which opens the Playwright Inspector
3. You interact with the **browser** (not the inspector)
4. When done, click **Resume** in the Playwright Inspector
5. The scenario continues with verification + next setup step

## Accounts (from seed data)

| Email | Password | Role |
|-------|----------|------|
| admin@qbengineer.local | (set via SEED_USER_PASSWORD env var) | Admin |
| akim@qbengineer.local | (set via SEED_USER_PASSWORD env var) | Engineer |
| dhart@qbengineer.local | (set via SEED_USER_PASSWORD env var) | Engineer |
| jsilva@qbengineer.local | (set via SEED_USER_PASSWORD env var) | Engineer |
| mreyes@qbengineer.local | (set via SEED_USER_PASSWORD env var) | Engineer |
