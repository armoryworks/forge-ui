import { parse } from 'papaparse';

import { TranslationExportRow } from '../models/translation-export-row.model';
import { TranslationImportPlan } from '../models/translation-import-plan.model';

/** Flattens a nested catalog to dotted keys; only string leaves are kept. */
export function flattenCatalog(node: Record<string, unknown>, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) flattenCatalog(v as Record<string, unknown>, key, out);
  }
  return out;
}

/** Rebuilds the nested catalog shape from dotted keys. */
export function nestCatalog(flat: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const key of Object.keys(flat).sort()) {
    const parts = key.split('.');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      const next = node[part];
      if (!next || typeof next !== 'object') node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = flat[key];
  }
  return root;
}

/**
 * Every shipped key for the language with the value the install shows: the override where one exists,
 * else the shipped text. Override keys the shipped catalog no longer has are dropped.
 */
export function buildExportRows(shipped: Record<string, string>, overrides: Record<string, string>): TranslationExportRow[] {
  return Object.keys(shipped).sort().map(key => {
    const override = overrides[key];
    const overridden = override !== undefined && override !== shipped[key];
    return { key, value: overridden ? override : shipped[key], shippedValue: shipped[key], overridden };
  });
}

/** Spreadsheet rows for the CSV export, header first. */
export function exportCsvRows(rows: TranslationExportRow[], headers: [string, string, string, string]): string[][] {
  return [headers, ...rows.map(r => [r.key, r.value, r.shippedValue, r.overridden ? 'yes' : ''])];
}

/**
 * Reads an imported file into key → value. JSON may be nested (the catalog shape) or flat; CSV needs
 * a `key` and a `value` column (the export's layout). Returns null when the file cannot be read.
 */
export function parseTranslationFile(text: string, fileName: string): Record<string, string> | null {
  const body = text.replace(/^\uFEFF/, '');
  if (fileName.toLowerCase().endsWith('.json') || body.trimStart().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? flattenCatalog(parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  const result = parse<Record<string, string>>(body, { header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase() });
  if (!result.meta.fields?.includes('key') || !result.meta.fields.includes('value')) return null;
  const out: Record<string, string> = {};
  for (const row of result.data) {
    const key = row['key']?.trim();
    if (key) out[key] = row['value'] ?? '';
  }
  return out;
}

/**
 * What an import would change against what the install shows now. Keys the shipped catalog does not
 * have are reported and left out; blank values and values equal to the current text are unchanged.
 */
export function planImport(
  imported: Record<string, string>,
  shipped: Record<string, string>,
  overrides: Record<string, string>,
): TranslationImportPlan {
  const plan: TranslationImportPlan = { changes: [], unchangedCount: 0, unknownKeys: [] };
  for (const key of Object.keys(imported).sort()) {
    const shippedValue = shipped[key];
    if (shippedValue === undefined) {
      plan.unknownKeys.push(key);
      continue;
    }
    const newValue = imported[key].trim();
    const currentValue = overrides[key] ?? shippedValue;
    if (!newValue || newValue === currentValue.trim()) {
      plan.unchangedCount++;
      continue;
    }
    plan.changes.push({ key, currentValue, newValue, shippedValue, revertsToShipped: newValue === shippedValue.trim() });
  }
  return plan;
}
