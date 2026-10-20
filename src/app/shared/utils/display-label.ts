const ACRONYMS: Readonly<Record<string, string>> = {
  abc: 'ABC', api: 'API', bi: 'BI', bom: 'BOM', capa: 'CAPA', csv: 'CSV', eco: 'ECO', ein: 'EIN',
  fai: 'FAI', fda: 'FDA', fx: 'FX', gl: 'GL', hts: 'HTS', icp: 'ICP', id: 'ID', itar: 'ITAR',
  kpi: 'KPI', mfa: 'MFA', mpn: 'MPN', mrp: 'MRP', nda: 'NDA', ncr: 'NCR', oee: 'OEE', ooc: 'OOC',
  pdf: 'PDF', pm: 'PM', po: 'PO', ppap: 'PPAP', qc: 'QC', rfq: 'RFQ', scac: 'SCAC', sku: 'SKU',
  sms: 'SMS', spc: 'SPC', uom: 'UoM', upc: 'UPC', url: 'URL', wip: 'WIP',
};

/**
 * Split an identifier (PascalCase, camelCase, snake_case, kebab-case or SCREAMING_CASE) into words.
 * A run of capitals stays one word until the capital that starts the next word: `CustomerPO` → Customer, PO;
 * `QCInspection` → QC, Inspection.
 */
export function identifierWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(w => w.length > 0);
}

/**
 * Sentence-case display text for an enum value or code the API sends as an identifier:
 * `InProgress` → "In progress", `QcInspection` → "QC inspection", `NET_30` → "Net 30".
 * Uses the same acronym set as the API's activity wording, so a value reads the same in both places.
 */
export function humanizeIdentifier(name: string | null | undefined): string {
  if (name === null || name === undefined) return '';
  const words = identifierWords(String(name));
  if (words.length === 0) return '';
  return words
    .map((w, i) => {
      const acronym = ACRONYMS[w.toLowerCase()];
      if (acronym) return acronym;
      const lower = w.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

/** camelCase i18n key segment for an identifier: `InProgress` → `inProgress`, `NET_30` → `net30`. */
export function camelKey(name: string): string {
  const words = identifierWords(name).map(w => w.toLowerCase());
  return words.map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

/** snake_case terminology-override key segment for an identifier: `InProduction` → `in_production`. */
export function snakeKey(name: string): string {
  return identifierWords(name).map(w => w.toLowerCase()).join('_');
}
