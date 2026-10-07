export const CAPABILITY_RELATED_SETTINGS: Record<string, string[]> = {
  'CAP-MD-PARTS': ['parts.allow_manual_numbers'],
  'CAP-MD-CUSTOMERS': ['customers.allow_manual_numbers'],
  'CAP-MD-VENDORS': ['vendors.allow_manual_numbers'],
  'CAP-O2C-LEAD': ['leads.allow_manual_numbers'],
  'CAP-O2C-QUOTE': ['quotes.allow_manual_numbers'],
  'CAP-O2C-SO': ['sales_orders.allow_manual_numbers'],
  'CAP-P2P-PO': ['purchase_orders.allow_manual_numbers'],
  'CAP-MFG-WO-RELEASE': ['jobs.allow_manual_numbers'],
  'CAP-O2C-SHIP': ['shipments.allow_manual_numbers'],
  'CAP-O2C-INVOICE': ['invoices.allow_manual_numbers'],
  'CAP-O2C-CASH': ['payments.allow_manual_numbers'],
};
