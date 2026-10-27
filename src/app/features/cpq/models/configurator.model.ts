/** A configurator in the list: its base part, base price and how many options it has. */
export interface Configurator {
  id: number;
  name: string;
  description: string | null;
  basePartId: number;
  basePartNumber: string;
  isActive: boolean;
  basePrice: number | null;
  optionCount: number;
  createdAt: string;
  updatedAt: string;
}
