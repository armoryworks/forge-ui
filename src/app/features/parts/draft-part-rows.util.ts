import { WorkflowRun } from '../../shared/models/workflow-run.model';
import { PartListRow } from './models/part-list-item.model';
import { InventoryClass } from './models/inventory-class.type';
import { ProcurementSource } from './models/procurement-source.type';
import { readTypedPartDraft } from './workflow/typed-part-draft.util';

/**
 * Builds the synthetic "ghost" rows for entity-less New Part drafts. Part
 * number, name and description are the text the New Part form kept on the
 * run (see {@link readTypedPartDraft}), and `unnamedLabel` is used when
 * neither a part number nor a name was typed. When `search` is non-blank,
 * only drafts whose typed part number, name or description contain it
 * (case-insensitive) are kept, so a draft with nothing typed drops out of any
 * search.
 *
 * @param runs entity-less Part workflow runs
 * @param search the search term currently applied to the parts list
 * @param unnamedLabel translated label for a draft with nothing typed yet
 */
export function buildDraftPartRows(runs: WorkflowRun[], search: string, unnamedLabel: string): PartListRow[] {
  const term = search.trim().toLowerCase();
  return runs
    .map(run => ({ run, ...readTypedPartDraft(run) }))
    .filter(d => !term || [d.partNumber, d.name, d.description].some(v => v.toLowerCase().includes(term)))
    .map(({ run, partNumber, name, description }) => ({
      id: -run.id,
      partNumber,
      name: name || (partNumber ? '' : unnamedLabel),
      description: description || null,
      revision: '',
      status: 'Draft' as const,
      procurementSource: payloadAxis<ProcurementSource>(run, 'procurementSource', 'Buy'),
      inventoryClass: payloadAxis<InventoryClass>(run, 'inventoryClass', 'Component'),
      bomLineCount: 0,
      createdAt: new Date(run.startedAt),
      effectivePrice: 0,
      effectivePriceCurrency: 'USD',
      effectivePriceSource: 'Default' as const,
      pendingWorkflow: null,
      _draftRun: run,
    }));
}

function payloadAxis<T extends string>(run: WorkflowRun, key: string, fallback: T): T {
  const value = run.draftPayload?.[key];
  return typeof value === 'string' && value ? (value as T) : fallback;
}
