import { DumpTableInfo } from './dump-table-info.model';

/** What a dump of this database would contain — the page's preview surface. */
export interface DatabaseTransferSummary {
  databaseName: string;
  tableCount: number;
  estimatedRows: number;
  totalBytes: number;
  tables: DumpTableInfo[];
}
