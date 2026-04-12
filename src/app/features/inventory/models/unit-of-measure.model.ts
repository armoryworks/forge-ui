export interface UnitOfMeasure {
  id: number;
  code: string;
  name: string;
  symbol: string | null;
  category: UomCategory;
  decimalPlaces: number;
  isBaseUnit: boolean;
  isActive: boolean;
  sortOrder: number;
}

export type UomCategory = 'Count' | 'Length' | 'Weight' | 'Volume' | 'Area' | 'Time';
