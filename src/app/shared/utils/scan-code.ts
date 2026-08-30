/** Kinds a scanned code can resolve to; mirrors docs labels.md and the server's BarcodeService prefixes. */
export type ScanKind =
  | 'job' | 'part' | 'bin' | 'lot' | 'badge'
  | 'salesOrder' | 'purchaseOrder' | 'asset' | 'enrollment' | 'unknown';

const PREFIXES: Record<string, ScanKind> = {
  JOB: 'job', PRT: 'part', LOC: 'bin', LOT: 'lot', EMP: 'badge',
  SO: 'salesOrder', PO: 'purchaseOrder', AST: 'asset',
};

/**
 * Local, offline hint of what a code is — decides which action sheet to
 * show while the server lookup runs. The server (`/mobile/scan/resolve`)
 * is the authority; this never navigates on its own.
 */
export function hintScanKind(raw: string): ScanKind {
  const value = raw.trim();
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as { server?: string; token?: string };
      if (parsed.server && parsed.token) return 'enrollment';
    } catch {
      return 'unknown';
    }
  }
  if (/^\d{8}$|^\d{12,14}$/.test(value)) return 'part';
  const dash = value.indexOf('-');
  if (dash <= 0) return 'unknown';
  return PREFIXES[value.slice(0, dash).toUpperCase()] ?? 'unknown';
}
