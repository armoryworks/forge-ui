/** Inventory tabs only some roles may open, with the roles that may open each. */
export const INVENTORY_TAB_ROLES: Readonly<Record<string, readonly string[]>> = {
  replenishment: ['Admin', 'Manager'],
};
