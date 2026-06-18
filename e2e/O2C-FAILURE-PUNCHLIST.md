# Order-to-Cash — Failure-Workflow Punch List

The standalone-accounting **happy path** is asserted by
[`tests/golden-path-accounting.spec.ts`](tests/golden-path-accounting.spec.ts) (9/9 green).
This list is the *failure* companion: for each edge of that path, the knowable
failure types and whether the system handles them — the "plan failures before
code" artifact. Most ✅ rows already have a probe in
[`tests/invariant-probes.spec.ts`](tests/invariant-probes.spec.ts); the oracle is
**illegal transition ⇒ 409**, never a 200-with-change or a 500.

Legend: ✅ handled + covered · ⚠️ partial / soft-gap · 🔲 unbuilt (no feature yet)

## Quote → Sales Order
| Failure | Status | Ref |
|---|---|---|
| Accept a non-`Sent` quote | ✅ blocked | `AcceptQuote` ("Only Sent…") |
| Convert an already-converted quote | ✅ 409 | `INV` F-033-I |
| Delete a non-`Draft` quote | ✅ 409 | `DeleteQuote` |
| Edit an SO line once the order is `Confirmed` | ✅ 409 (editable on Draft) | `INV-SO2` |

## Sales Order → Ship
| Failure | Status | Ref |
|---|---|---|
| Ship before the order is confirmed | ✅ blocked ("must be confirmed") | `CreateShipment` + golden-path |
| Over-ship (qty > remaining) | ✅ 409 | `INV-SH1` + golden-path #6 |
| Ship a part not on the order | ✅ rejected | `CreateShipment` part-path guard |
| Cancel a `Shipped` order | ✅ 409 | `INV` F-033-D |
| **Lost / stolen / damaged in transit** | 🔲 unbuilt | no in-transit exception flow |

## Ship → Invoice
| Failure | Status | Ref |
|---|---|---|
| Invoice on a clean standalone install (no seeded currency) | ✅ **fixed** (was 500) | essential `Currency` seed |
| Double-invoice a shipment | ✅ 409 (was 500) | `INV-IN2` guard + golden-path #7 |
| Invoice more than shipped (goods lines) | ⚠️ partial — only lines with `PartId` | `INV-INV2` (soft) |
| Void a `Draft` invoice | ✅ 409 | F-033-A |
| Re-void a `Voided` invoice | ✅ 409 | F-033-B |
| Void a `Sent`, zero-payment invoice | ✅ 2xx (legal) | F-033-C |

## Invoice → Payment
| Failure | Status | Ref |
|---|---|---|
| Pay a `Draft` (un-sent) invoice | ✅ 409 | `CreatePayment` + golden-path (send-first) |
| Over-apply (payment > balance) | ✅ 409 | `CreatePayment` |
| Same invoice referenced twice in one payment | ✅ 400 | `CreatePaymentValidator` |
| Concurrent payment on one invoice | ✅ 409 | `CreatePayment` concurrency guard |
| **Refund / negative payment** | 🔲 unbuilt | F-033-J (stub) |

## Payment → Completion
| Failure | Status | Ref |
|---|---|---|
| SO auto-completes when fully shipped + invoiced + paid | ✅ **fixed** (was stuck `Shipped`) | `CreatePayment` + golden-path #9 |
| Complete strictness — "fully invoiced" (every shipment invoiced) | ⚠️ refinement — today: `Shipped` + all issued invoices paid | — |

## Cross-cutting (meeting notes, standalone accounting)
| Item | Status | Ref |
|---|---|---|
| Inventory gate — can't ship unaccounted goods | ✅ | `INV-SH1` |
| Ledger immutability — no hard delete; reversing entries only | ✅ | `acct_journal_*` triggers; soft-delete only |
| Effective-dating (old address inactive, not overwritten) | ✅ | data architecture |
| **Carrier label-scan-to-ship** (integrated carriers) | 🔲 unbuilt | shipping epic |
| **Restricted manual delivery** | 🔲 unbuilt | shipping epic |
| **Mark-delivered automation** (tracking) | 🔲 unbuilt | shipping epic |
| **Custom / shadow shipper** | 🔲 unbuilt | shipping epic |
| Production over-complete (good > started − scrap) | ⚠️ soft known-gap | `INV-SF2` |

## Next (80/20, by impact)
1. **Carrier epic** — label + scan-to-ship + restricted manual delivery + custom shipper (the four 🔲 above). Needs the ★ product decisions (scan target == tracking #? what counts as "automation-capable").
2. **Harden the soft gaps** — `INV-INV2` over-issue (non-`PartId` lines), `INV-SF2` over-complete: flip the probes' soft assertions once the guards land.
3. **In-transit exceptions** — lost/stolen/damaged: the notes' "knowable failure types" the golden path doesn't yet model.
4. **Refund** — F-033-J stub → real handler.
