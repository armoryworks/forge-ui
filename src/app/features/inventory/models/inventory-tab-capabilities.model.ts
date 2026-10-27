/** Inventory tabs that show only while a capability is on, with the capability each one needs. */
export const INVENTORY_TAB_CAPABILITIES: Readonly<Record<string, string>> = {
  inspection: 'CAP-QC-INSPECTION',
  reservations: 'CAP-INV-RESERVE',
  transfers: 'CAP-INV-MULTILOC',
  abc: 'CAP-PLAN-ABC',
  replenishmentCards: 'CAP-EXT-KANBAN-REPLENISHMENT',
};
