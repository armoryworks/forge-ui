import { PoLineEntry } from '../../models/po-line-entry.model';
import { CreatePurchaseOrderLineRequest } from '../../models/create-purchase-order-line-request.model';
import { CheckTierVarianceLine } from '../../models/tier-variance-check.model';

export function toCreateLineRequest(line: PoLineEntry): CreatePurchaseOrderLineRequest {
  const notes = line.notes?.trim();
  return {
    partId: line.partId,
    description: line.partId == null ? line.description : undefined,
    quantity: line.orderedQuantity,
    unitPrice: line.unitPrice,
    notes: notes || undefined,
    purchaseUnitId: line.partId == null ? null : (line.purchaseUnitId ?? null),
    manualOverrideReason: line.overrideReason ?? undefined,
  };
}

export function toTierVarianceLines(lines: PoLineEntry[]): CheckTierVarianceLine[] {
  return lines.flatMap(l => l.partId == null ? [] : [{
    partId: l.partId,
    quantity: l.orderedQuantity,
    unitPrice: l.unitPrice,
    purchaseUnitId: l.purchaseUnitId ?? null,
  }]);
}
