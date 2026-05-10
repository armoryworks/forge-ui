import { Routes } from '@angular/router';
import { LeadsComponent } from './leads.component';

/**
 * Phase 1r / Batch 2 — Leads becomes a sub-route hub for high-volume
 * marketing surfaces. The bare `/leads` path keeps resolving to the
 * existing list component so cross-entity links (`?detail=lead:123`,
 * direct bookmarks) still work; the new children land alongside.
 *
 * Stub pages (intake / queue / campaigns / suppression) ship with this
 * batch; real implementations land in subsequent batches:
 *  - Batch 4 fills /leads/intake
 *  - Batch 6 fills /leads/queue
 *  - Batch 5 fills /leads/campaigns
 *  - Batch 1 backend + this batch's stub fill /leads/suppression
 *    (UI to come in a later commit once a list-of-suppressed-leads
 *    endpoint exists)
 */
export const LEADS_ROUTES: Routes = [
  { path: '', component: LeadsComponent },
  {
    path: 'intake',
    loadComponent: () => import('./pages/intake/leads-intake.component').then(m => m.LeadsIntakeComponent),
  },
  {
    path: 'queue',
    loadComponent: () => import('./pages/queue/leads-queue.component').then(m => m.LeadsQueueComponent),
  },
  {
    path: 'campaigns',
    loadComponent: () => import('./pages/campaigns/leads-campaigns.component').then(m => m.LeadsCampaignsComponent),
  },
  {
    path: 'suppression',
    loadComponent: () => import('./pages/suppression/leads-suppression.component').then(m => m.LeadsSuppressionComponent),
  },
  // Phase 1r / Batch 16 — pre-quote sample shipment tracking. Shows samples
  // across all leads with status lifecycle (Requested / Approved / Shipped /
  // Delivered / Outcome) so sales managers can see what's in flight.
  {
    path: 'samples',
    loadComponent: () => import('./pages/samples/leads-samples.component').then(m => m.LeadsSamplesComponent),
  },
  // Phase 1r / Batch 12 — multi-contact B2B parent groupings. Lead.accountId
  // optionally points at one of these so reps managing a complex prospect
  // can keep all relevant contacts under one umbrella.
  {
    path: 'accounts',
    loadComponent: () => import('./pages/accounts/leads-accounts.component').then(m => m.LeadsAccountsComponent),
  },
];
