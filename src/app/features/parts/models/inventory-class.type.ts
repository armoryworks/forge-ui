/**
 * Pillar 1 — Which inventory bucket a part lives in. Mirrors the server enum
 * <c>QBEngineer.Core.Enums.InventoryClass</c>.
 */
export type InventoryClass =
  | 'Raw'
  | 'Component'
  | 'Subassembly'
  | 'FinishedGood'
  | 'Consumable'
  | 'Tool';

export const INVENTORY_CLASSES: readonly InventoryClass[] = [
  'Raw', 'Component', 'Subassembly', 'FinishedGood', 'Consumable', 'Tool',
] as const;
