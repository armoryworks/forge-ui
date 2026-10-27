export interface CoaResult {
  id: number;
  sortOrder: number;
  characteristic: string;
  specification: string | null;
  specMin: number | null;
  specMax: number | null;
  specTarget: number | null;
  result: string | null;
  unit: string | null;
  method: string | null;
  pass: boolean;
  sourceType: 'Inspection' | 'Spc';
  sourceId: number | null;
}
