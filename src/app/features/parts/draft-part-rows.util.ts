import { WorkflowRun } from '../../shared/models/workflow-run.model';
import { PartListRow } from './models/part-list-item.model';
import { InventoryClass } from './models/inventory-class.type';
import { ProcurementSource } from './models/procurement-source.type';

/**
 * Builds the synthetic "ghost" rows for entity-less New Part drafts. Part
 * number, name and description are read from the run's `draftPayload` when
 * present, and `unnamedLabel` is used when neither a part number nor a name
 * is there. When `search` is non-blank, only drafts whose payload part
 * number, name or description contain it (case-insensitive) are kept, so a
 * draft without those keys drops out of any search.
 *
 * @param runs entity-less Part workflow runs
 * @param search the search term currently applied to the parts list
 * @param unnamedLabel translated label for a draft with nothing typed yet
 */
export function buildDraftPartRows(runs: WorkflowRun[], search: string, unnamedLabel: string): PartListRow[] {
  const term = search.trim().toLowerCase();
  return runs
    .map(run => {
      const partNumber = payloadText(run, 'partNumber');
      const name = payloadText(run, 'name');
      const description = payloadText(run, 'description');
      return { run, partNumber, name, description };
    })
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

function payloadText(run: WorkflowRun, key: string): string {
  const value = run.draftPayload?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function payloadAxis<T extends string>(run: WorkflowRun, key: string, fallback: T): T {
  const value = run.draftPayload?.[key];
  return typeof value === 'string' && value ? (value as T) : fallback;
}
