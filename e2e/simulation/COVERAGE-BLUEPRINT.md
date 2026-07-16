# Forge Simulation — Coverage Blueprint

> **Purpose.** This is the design spec for the Forge business-process simulation: the
> corpus that trains every AI/RAG feature and exercises broad application functionality.
> It records (a) the target — a deep, realistic, interconnected 15-year business history —
> (b) what the API can drive **today** vs. what is **backend-blocked**, and (c) the backend
> work required to reach ~100% coverage. Grounded in a full sweep of the ~151 forge-api
> controllers (2026-07-03).
>
> **Realistic but not real.** All data is synthetic. Anything that would hit an external
> service (carriers, email/voice, address validation, QBO) must run through the
> `MockIntegrations=true` path.

---

## 1. Architecture: stateless backfill → stateful narrative

The current `week-scenario-api.ts` is a **stateless weekly backfill**: each week it re-queries
("give me some Draft quotes") and acts on whatever it finds. That's fine for volume, but it
cannot express *intent* — "**this** SO is deposit-at-confirmation then balance-at-completion;
**that** one cancels late so a fee-invoice fires; **these** raw-material lots are consumed into
**that** produced lot which is later recalled."

The target requires a **stateful narrative simulation**:

- **Entities are spawned with an assigned storyline** — a target end-state plus a payment plan,
  fulfillment path, and quality outcome — and driven deterministically toward it across weeks.
- **A persistent ledger** (JSON on disk, keyed by entity id) tracks each entity's storyline and
  progress so a resumable run advances each one correctly.
- **Weighted outcome distributions** (below) decide, at spawn time, which storyline each entity
  gets, so the corpus contains the full realistic spread of happy/unhappy paths.
- **Actors are role-correct**: the buyer raises POs, QC runs inspections, the operator logs
  labor, the office manager takes payments. (The 6 seed drivers already map to roles.)
- **The business grows**: customers, employees, machines, and demand scale up over 15 years,
  with seasonality and the occasional downturn — not a flat rate.

The existing weekly scenario becomes the "ambient churn" layer; the storyline engine sits on top.

---

## 2. Coverage matrix (grounded verdicts)

`✅ FULLY` = drivable end-to-end via API today · `⚠️ PARTIAL` = works with the noted limitation ·
`⛔ BLOCKED` = no write path; needs backend work.

### Order-to-Cash
| Capability | Verdict | Notes |
|---|---|---|
| Leads → qualify → convert to customer | ✅ | lost/failed leads supported (status) |
| Lead **multiple contacts** | ⚠️ | leads carry a single contact; no lead-contacts sub-resource |
| Estimates → lines → reject → convert to quote | ✅ | "reject" is a status update, no dedicated endpoint |
| Quotes → lines → send → accept/reject → convert to SO | ✅ | |
| **Quote custom-price override lines** | ✅ | explicit line `unitPrice` honored; **no override-reason/audit field** |
| Customer **price lists / tier pricing** | ✅ | `price-lists`, `CustomerPriceResolver` auto-fills line price when 0 |
| SO confirm → **auto-create 1 job per line** | ✅ | idempotent on re-confirm |
| **SO in-flight modification** | ⚠️ | lines editable **only while Draft**; confirmation is the hard lock — there is **no mid-production modification window** |
| SO cancellation (early/late) | ✅ | Draft / Confirmed / PartiallyShipped |
| **Late-cancellation FEE invoice** | ⛔ | no auto fee; depends on credit-memo (unimplemented) |
| **Deposit / 50-50 / pay-before-production schedules** | ⛔ | only static `Net-N` terms; `ScheduleMilestone` is read-only/auto; no deposit/milestone-payment endpoints |
| **Split / partial invoicing** (one invoice per delivered portion) | ✅ | exactly the model you described; qty-guarded (invoiced ≤ shipped) |
| Payments + application to invoices | ✅ | single-shot; no scheduled tranches |
| Credit memos | ⛔ | capability gated, **no implementation** |
| AR collections / dunning | ⛔ | capability gated, **no implementation** |

### Fulfillment & Traceability
| Capability | Verdict | Notes |
|---|---|---|
| Shipments: partial, **multiple per SO, different carrier, different days** | ✅ | states: Pending→Packed→Shipped→InTransit→Delivered; "shipped-but-not-received" = InTransit |
| Carriers + **rate / label / tracking / pickup** | ✅ | **mockable** via `MockIntegrations=true` (MockShippingService); multi-carrier master data |
| Lots (create, expiry/FEFO, tie to part/job/PO-line) | ✅ | |
| Serials + **recursive genealogy** (forward/back) | ✅ | serialized traceability works |
| **Lot-consumption genealogy** (raw-lot → produced-lot edges) | ⛔ | **keystone gap** — table/entity/schema exist, **zero code writes them**, and `trace` doesn't read them yet |
| **Recalls** (lot-based, forward/back trace, quarantine) | ⛔ | no controller; depends on lot genealogy |
| **Certificate of Analysis (COA)** at ship | ⛔ | capability gated, no implementation |
| Customer returns / RMA (create → resolve → close, rework job) | ✅ | |
| Receiving inspection on PO receipt | ✅ | templates + QC inspection |

### Manufacturing master data
| Capability | Verdict | Notes |
|---|---|---|
| Part kinds (injection-molded / purchased / manufactured / assembly / super-assembly) | ✅ | `procurementSource × inventoryClass × itemKind` |
| **Multi-level BOM** incl. super-assemblies, cycle-guard, immutable revisions | ✅ | arbitrary nesting |
| **Routing** (operations, work-centers, subcontract steps) | ✅ | **unblocks promoting parts to Active** (BOM+routing+cost→promote) |
| **Vendor-part pricing: qty price-breaks, preferred vendor, multi-vendor AVL** | ✅ | `vendor-parts` + `price-tiers` — your "price points by volume" |
| PO line price + **manual override reason** | ✅ | no auto-fill from tiers (caller picks the tier) |
| Standard cost rollup (BOM+routing) + manual override | ⚠️ | no ABC auto-assign, no departmental/activity-based costing |
| Engineering Change Orders | ⚠️ | ECO record + approve/implement workflow; does **not** auto-apply the BOM delta |

### Procure-to-Pay
| Capability | Verdict | Notes |
|---|---|---|
| PO create → submit → acknowledge → receive (into bins) | ✅ | freight allocation methods supported |
| RFQ (multi-vendor sourcing) | ✅ | `purchasing` |
| Vendor bills + **3-way match**, vendor payments (AP) | ✅ | drives the money-out side |
| Auto-PO from MRP/reorder | ✅ | needs MRP data |
| Back-to-back / drop-ship / subcontract send-out | ✅ | |
| NACHA/ACH origination + dual-control | ✅ | `banking` |

### CRM & Collaboration
| Capability | Verdict | Notes |
|---|---|---|
| **Customer multiple contacts** (title/dept/role/primary) | ✅ | `POST /customers/{id}/contacts` (+ outreach-preferences) |
| **Customer interactions** (call/email/meeting/note log) | ✅ | `POST /customers/{id}/interactions` |
| Multi ship-to / bill-to addresses | ✅ | `customers/{id}/addresses` |
| Outreach campaigns | ✅ | |
| Order-tied communications log | ⚠️ | order events surface as notifications; no interaction log bound to an order |
| Chat, entity comments/notes, announcements, follow-up tasks | ✅ | |

### Everything else (currently uncovered by the sim, but drivable)
Quality suite: NCR ✅, CAPA ✅, FMEA ✅, SPC ✅, PPAP ✅, receiving-inspection ✅, gage-calibration ⛔(reported no controller — verify), COA ⛔.
HR: onboarding ✅, leave ✅, shifts ✅, training/certs ✅, reviews ⚠️(read-only), payroll ⚠️(partial).
Planning: MRP ✅, replenishment/safety-stock ✅, ABC ✅, scheduling ✅, planning-cycles ✅; MPS/forecast/ATP ⛔(reported no controller — verify).
Maintenance: PM schedules ✅, breakdown/corrective ✅, machine hours ✅, downtime ✅; OEE report ⚠️.
Inventory: locations/bins ✅, receive/adjust/transfer ✅, physical/cycle-count ✅, kanban replenishment ✅, pick waves ✅, reservations ✅.
Accounting: built-in AR/AP/expense ✅; **Full GL / journal entries** ⛔(dark), depreciation ⛔, FX-reval ⛔.
Other: projects ✅, sales-tax ✅, EDI ✅(mock), controlled documents ✅, deliverables ✅, sample shipments ✅, customer portal ⚠️(stub), andon ✅, AI/RAG ✅, **AI provenance** ⛔(stamper dead-wired), **watchtower** ⛔(capability code absent from descriptor → 404).

---

## 3. Your scenarios, mapped

Everything you enumerated, with the verdict:

1. Purchased material ↔ vendors at **volume price points**, **price overrides**, several POs — **✅ build now** (vendor-parts price-tiers; PO override reason).
2. Assemblies (injection-molded parts) → **super-assemblies** of manufactured parts, **BOMs + routing** — **✅ build now** (multi-level BOM + operations; promote to Active).
3. Leads (some failed) → customers; **estimates** (some rejected) → **quotes** (line-item parts + **custom override lines**, some rejected) → **sales orders** — **✅ build now**.
4. All SO line items → **jobs** — **✅ build now** (auto on confirm).
5. **Modify SO in-flight before a critical production point** — **⚠️ partial** — only while Draft; confirmation is the lock. *(Needs backend: a modification window post-confirm.)*
6. Cancel SOs; **late cancel → fee via invoice, no SO completion** — **⛔ blocked** (no cancellation-fee/credit-memo path).
7. Jobs mid-flight / some complete; SOs complete-but-not-packed / partially-shipped / unshipped / **shipped-not-received** — **✅ build now** (job stages + shipment states).
8. Payment terms: **full-on-delivery / 50-at-confirmation-50-at-completion / full-before-production** — **⛔ blocked** (no deposit/milestone-payment schedule).
9. **Split invoice per delivered portion, different days, different carriers** — **✅ build now** (invoice-per-shipment + multi-carrier).
10. **Multiple carriers** with rich carrier data — **✅ build now** (mock mode).
11. **Returns** (some in-flight, some complete) — **✅ build now** (RMA lifecycle).
12. **Recalls; lot-based recall traced on raw materials in a produced part** — **⛔ blocked** (lot-consumption genealogy has no write path; no recall controller). **This is the single biggest backend gap.**
13. **Each item's history fleshed out** (comments, notes, activity, attachments, status) — **✅ build now** for every entity type in the AllowedEntityTypes set.
14. **Lead/customer contacts fleshed out; communications about orders** — **✅ mostly** (customer contacts + interactions ✅; lead multi-contact ⚠️; order-tied comms log ⚠️).

---

## 4. What's missing from the enumeration (things to add for ~100%)

Your list is the O2C/fulfillment spine. A true full-coverage corpus also needs the **surrounding
systems that generate and constrain that spine** — these are the "you missed":

- **Quality workflow that *produces* the returns/recalls you want:** incoming-inspection on PO
  receipt → NCR on non-conformance → CAPA → verification; in-process SPC samples with occasional
  out-of-control; FMEA on new parts; PPAP submissions for automotive customers; gage calibration
  cycles. *(The 15-year run already shows QC gates blocking job completion — that dynamic should be
  intentional, not incidental.)*
- **Planning/MRP demand engine:** forecast/MPS → MRP explosion → planned orders → **auto-PO** and
  **safety-stock replenishment**; finite-capacity scheduling; ABC-driven cycle counts. This is what
  makes purchasing and inventory *causal* rather than random.
- **HR/labor as a constraint:** employees hired/onboarded over time; **training/certifications that
  gate who can be assigned to a job** (compliance is already enforced); leave/shifts affecting
  capacity; performance reviews; payroll runs.
- **Maintenance ↔ production coupling:** machine hours accrue → PM comes due → breakdown downtime →
  OEE impact → schedule disruption. (Assets/PM/downtime exist; wire them to job delays.)
- **The money flow-through:** every SO/shipment/invoice/payment, every PO/receipt/vendor-bill/
  vendor-payment, every expense and payroll run should land in **built-in accounting** (Full GL is
  dark, but AR/AP/expense post). Bank reconciliation, 3-way match, AP payment runs / NACHA batches.
- **Approvals everywhere:** expense approvals, PO approvals, credit-limit holds, journal maker-checker.
- **Document lifecycle:** controlled documents (SOPs, work instructions) with revisions; ECO-driven
  supersession; drawings/specs attached to parts and revised.
- **Exception & unhappy paths as first-class, weighted outcomes** (not just happy path): lost leads,
  rejected quotes/estimates, scrapped jobs, late deliveries, quality escapes, delinquent payments,
  stockouts, machine breakdowns, short-shipments, backorders.
- **Business realism dimensions:** growth curve (customers/employees/machines scale over 15y),
  seasonality, a downturn or two; multi-plant / multi-location / **multi-currency**; realistic
  time-of-day/shift patterns for labor and clock events.
- **Collaboration density:** the "history" requirement means driving comments, notes, status
  changes, attachments, chat, and interactions on **every** entity — not a sampled few — so the RAG
  corpus is uniformly rich.

---

## 5. Backend work required to unblock the full vision (prioritized)

Ordered by how much of your enumeration each unblocks:

1. **Lot-consumption genealogy write path** *(keystone — unblocks #12)*. Populate `lot_consumptions`
   at material-issue or job/run completion (pick one write point), and extend `GetLotTraceability`
   to traverse the edges (forward inputs, backward outputs). Everything recall-related sits on this.
2. **Recall controller/feature** — initiate recall on a lot, compute affected produced lots +
   customers from genealogy, snapshot an immutable notification list, quarantine on-hand. *(Depends on #1.)*
3. **Milestone / staged payment schedule** on SO/Invoice — deposit, pre-production, 50-50,
   progress payments. *(Unblocks #8.)*
4. **Cancellation-fee path** — either a standalone fee-invoice or wire up **credit memos** (currently
   gated-but-unimplemented). *(Unblocks #6.)*
5. **Post-confirmation SO modification window** up to a "production-committed" point. *(Unblocks #5.)*
6. **COA generation** at ship for lot-traced parts. *(Regulated-parts coverage.)*
7. Smaller: **quote-line price-override reason/audit field**; **order-tied communications log**;
   **lead multi-contact** sub-resource; register the **watchtower capability** + seed proposals;
   wire **AI-provenance** stamping; **SDS / GS1 / compliance-profile** write endpoints (previously
   flagged). AR **collections/dunning**, **depreciation**, **FX-reval**, **MPS/forecast/ATP** if
   those domains are in scope (reported absent — confirm).

---

## 6. Realistic outcome distributions (spawn-time weights)

Starting targets for the storyline engine (tune later). Percentages are of the cohort entering
each stage.

- **Leads:** 55% lost/dormant · 45% qualified → of those, 70% → estimate/quote.
- **Estimates:** 30% rejected · 70% → quote.
- **Quotes:** 25% rejected/expired · 75% accepted → SO.
- **Sales orders:** 8% cancelled early · 4% cancelled late (fee) · 88% proceed. Of proceeding:
  60% single full shipment · 25% split/partial (2–3 shipments, mixed carriers/days) · 15% long-running.
- **Payment terms mix:** 45% Net-30/45/60 · 20% deposit+balance · 15% pay-before-production ·
  20% on-delivery. *(deposit/pre-production require backend #3.)*
- **Jobs:** 88% complete clean · 7% QC fail → NCR/CAPA (rework or scrap) · 5% scrapped.
- **Fulfillment states at any snapshot:** ~20% unshipped · ~15% in production · ~10% packed-not-shipped ·
  ~15% partially shipped · ~20% in-transit (shipped-not-received) · ~20% delivered/closed.
- **Returns:** ~3% of delivered orders → RMA (half rework, half credit). **Recalls:** 1–2 lot-based
  events across the 15 years *(requires backend #1/#2)*.
- **Purchasing:** each Make part sourced from 1–3 vendors with 2–4 qty price-break tiers; ~10% of PO
  lines carry a manual price override.

---

## 7. Current state (what the extended weekly scenario already drives)

As of 2026-07-03 the API scenario (`week-scenario-api.ts`) covers, per week: leads (create/advance/
convert), estimates *(to add)*, quotes (create/send/accept/convert, convert-idempotent), SO confirm,
jobs (create/advance/dispose), time entries + clock events, expenses **with receipts**, POs
(create/submit/ack/receive), shipments, invoices (incl. split), payments, assets + PM + downtime +
machine hours, QC inspections (+ NCR gate now enforced), standalone parts + **multi-level BOM**,
vendors, inventory (locations/bins/receive/lots/movements), calendar events + attendees + RSVP,
entity comments/notes, chat, file attachments (drawings/receipts/manuals), AI/RAG index + search.

**Not yet driven (next to add, all ✅ buildable):** routing + part promotion to Active; vendor-part
price tiers; RFQ; vendor bills + 3-way match + AP payments; customer contacts + interactions;
multi-address; returns/RMA; serials + genealogy; the QC suite (NCR→CAPA, SPC, FMEA, PPAP); planning
(MRP/replenishment/ABC/scheduling); HR (onboarding/leave/shifts/training/reviews/payroll); projects;
controlled documents; sample shipments; banking/NACHA; sales-tax; EDI(mock); customer portal; andon.

**Blocked until backend lands (§5):** lot genealogy, recalls, COA, milestone/deposit payments,
cancellation fees, post-confirm SO edits, AI provenance, watchtower, SDS/GS1/compliance-profiles.
