/**
 * S4b provenance — presentation maps for `PurchaseOrder.originSource`.
 * Mirrors the server-side `Forge.Core.Enums.PoOriginSource` values exactly
 * (Manual | AutoMrp | AutoQuote | ExternalIntegration | Edi). Shared by the
 * PO list's Origin column chip and the detail panel's header chip so the two
 * surfaces can't drift.
 */
export const PO_ORIGIN_CHIP_CLASSES: Record<string, string> = {
  Manual: 'chip--muted',
  AutoMrp: 'chip--info',
  AutoQuote: 'chip--primary',
  ExternalIntegration: 'chip--success',
  Edi: 'chip--warning',
};

export const PO_ORIGIN_ICONS: Record<string, string> = {
  Manual: 'person',
  AutoMrp: 'auto_awesome',
  AutoQuote: 'request_quote',
  ExternalIntegration: 'cloud_sync',
  Edi: 'swap_horiz',
};

export const PO_ORIGIN_LABEL_KEYS: Record<string, string> = {
  Manual: 'purchaseOrders.originManual',
  AutoMrp: 'purchaseOrders.originAutoMrp',
  AutoQuote: 'purchaseOrders.originAutoQuote',
  ExternalIntegration: 'purchaseOrders.originExternalIntegration',
  Edi: 'purchaseOrders.originEdi',
};

export interface PoOriginFields {
  originSource: string;
  originUserName: string | null;
  originReference: string | null;
}

export function poOriginLabel(origin: PoOriginFields, translate: (key: string) => string): string {
  if (origin.originSource === 'ExternalIntegration' && origin.originReference) return origin.originReference;
  const key = PO_ORIGIN_LABEL_KEYS[origin.originSource];
  return key ? translate(key) : origin.originSource;
}

export function poOriginTooltip(
  origin: PoOriginFields,
  translate: (key: string, params?: Record<string, string>) => string,
): string {
  const parts: string[] = [];
  if (origin.originUserName)
    parts.push(translate('purchaseOrders.originTooltipUser', { name: origin.originUserName }));
  if (origin.originReference)
    parts.push(translate('purchaseOrders.originTooltipReference', { reference: origin.originReference }));
  if (parts.length > 0) return parts.join(' — ');
  const key = PO_ORIGIN_LABEL_KEYS[origin.originSource];
  return key ? translate(key) : origin.originSource;
}
