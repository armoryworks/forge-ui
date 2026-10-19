/** Purchase-order tabs only some roles may open, with the roles that may open each. */
export const PURCHASE_ORDERS_TAB_ROLES: Readonly<Record<string, readonly string[]>> = {
  settings: ['Admin'],
};
