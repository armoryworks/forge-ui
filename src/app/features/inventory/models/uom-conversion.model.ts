export interface UomConversion {
  id: number;
  fromUomId: number;
  fromUomCode: string;
  toUomId: number;
  toUomCode: string;
  conversionFactor: number;
  partId: number | null;
  isReversible: boolean;
}
