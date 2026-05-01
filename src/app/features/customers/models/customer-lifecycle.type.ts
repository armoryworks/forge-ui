/**
 * Pillar 5 — Customer detail axis discriminator.
 *
 * The Customer entity does not yet carry a `customerType` / `tier` field, so
 * Pillar 5 derives a lifecycle bucket from `(IsActive, openDocCount)`:
 *
 * - `Active`   — IsActive = true AND ≥1 open document (estimate / quote /
 *                order / job / invoice). The full business layout applies.
 * - `Prospect` — IsActive = true but zero open documents. Mid-onboarding;
 *                Orders / Jobs / Invoices tabs hidden until first work.
 * - `Archived` — IsActive = false. Read-only history only.
 *
 * This is the discriminator key consumed by
 * `CustomerDetailLayoutResolverService.resolve(...)`.
 *
 * Forward-compatibility note: when a real `CustomerType` discriminator
 * (Direct / Distributor / Reseller / Internal) lands on the entity, the
 * resolver can switch to a two-axis tuple (lifecycle × type) without changing
 * the shell signature.
 */
export type CustomerLifecycle = 'Active' | 'Prospect' | 'Archived';
