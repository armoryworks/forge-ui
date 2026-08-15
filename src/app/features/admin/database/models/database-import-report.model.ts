import { FkOrphanInfo } from './fk-orphan-info.model';
import { ImportedTableResult } from './imported-table-result.model';

/**
 * Outcome of a clean-rebuild import. `success` is false only when FK orphans were found and not
 * explicitly allowed — the data IS loaded either way; the flag means the rebuild needs another pass.
 */
export interface DatabaseImportReport {
  success: boolean;
  loaded: ImportedTableResult[];
  excluded: string[];
  missingInTarget: string[];
  softDeletedPurged: number;
  fkOrphans: FkOrphanInfo[];
}
