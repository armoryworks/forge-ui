import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { EstimateRequest, EstimateResult } from '../models/estimate-compute.model';

// ── Stub (remove when POST /api/v1/estimates/compute is live) ─────────────────
//
// ASSUMPTION: endpoint = POST /api/v1/estimates/compute
// PENDING: eng-lead confirmation of HTTP path + verb.
// Flag raised to orchestrator 2026-05-21.
//
// The stub produces a plausible decreasing-unit-price cost curve so the
// result panel renders end-to-end.  Numbers are fictional.

function mockCompute(req: EstimateRequest): EstimateResult {
  const qty = [...req.breakQuantities].sort((a, b) => a - b);
  const nreTotal = req.nreLines.reduce((s, l) => s + l.amount, 0);
  const pv = req.pricing.value; // already 0-1 from component

  const breaks = qty.map((q) => {
    // Fake diminishing unit cost as qty rises (setup amortises)
    const unitCost = Math.max(5, 40 - q * 0.05);
    const laborC = unitCost * 0.30 * q;
    const burdenC = unitCost * 0.15 * q;
    const matC = unitCost * 0.50 * q;
    const ospC = 0;
    const nreC = nreTotal;
    const totalCost = laborC + burdenC + matC + ospC + nreC;

    const unitPrice =
      req.pricing.mode === 'Margin'
        ? unitCost / (1 - pv)
        : unitCost * (1 + pv);
    const extendedPrice = unitPrice * q;
    const effectiveMargin = (unitPrice - unitCost) / unitPrice;

    return {
      quantity: q,
      cost: { laborCost: laborC, burdenCost: burdenC, materialCost: matC, ospCost: ospC, nreCost: nreC, totalCost },
      unitCost,
      unitPrice,
      extendedPrice,
      effectiveMargin,
    };
  });

  const warnings: string[] = [];
  if (qty.length < 2) {
    warnings.push('Only one break quantity — monotonicity check skipped.');
  }

  return { breaks, inputHash: 'mock-' + Date.now().toString(36), warnings };
}
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EstimateService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/estimates/compute`;

  // Flip to false once POST /api/v1/estimates/compute is deployed.
  private readonly useMock = true;

  compute(request: EstimateRequest): Observable<EstimateResult> {
    if (this.useMock) {
      return of(mockCompute(request)).pipe(delay(400));
    }
    return this.http.post<EstimateResult>(this.endpoint, request);
  }
}
