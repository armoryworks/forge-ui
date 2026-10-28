import { CatalogSettingSection } from './catalog-setting-section.model';

export const CATALOG_SETTING_SECTIONS: CatalogSettingSection[] = [
  {
    key: 'shop-floor-rules',
    group: 'Shop Floor',
    titleKey: 'admin.catalogSettings.shopFloorRules',
    icon: 'rule',
    fields: [
      { key: 'shop-floor.labor-split', labelKey: 'admin.catalogSettings.laborSplit' },
      { key: 'shop-floor.backflush-default', labelKey: 'admin.catalogSettings.backflushDefault' },
      { key: 'shop-floor.step-gating', labelKey: 'admin.catalogSettings.stepGating' },
      { key: 'shop-floor.max-overrun-percent', labelKey: 'admin.catalogSettings.maxOverrunPercent' },
      { key: 'shop-floor.recent-job-days', labelKey: 'admin.catalogSettings.recentJobDays' },
      { key: 'shop-floor.stale-timer-hours', labelKey: 'admin.catalogSettings.staleTimerHours' },
    ],
  },
  {
    key: 'payments-credits',
    group: 'Payments',
    titleKey: 'admin.catalogSettings.paymentsCredits',
    icon: 'payments',
    fields: [
      { key: 'terms.discount_base', labelKey: 'admin.catalogSettings.discountBase' },
      { key: 'terms.discount_grace_days', labelKey: 'admin.catalogSettings.discountGraceDays' },
      { key: 'rma.restocking_fee_percent', labelKey: 'admin.catalogSettings.restockingFeePercent' },
      { key: 'ar.writeoff_reverses_tax', labelKey: 'admin.catalogSettings.writeOffReversesTax' },
      { key: 'payments.modification-policy', labelKey: 'admin.catalogSettings.paymentModificationPolicy' },
    ],
  },
  {
    key: 'quotes',
    group: 'Sales',
    titleKey: 'admin.catalogSettings.quotes',
    icon: 'request_quote',
    fields: [
      { key: 'quotes.default_valid_days', labelKey: 'admin.catalogSettings.quoteValidDays' },
    ],
  },
  {
    key: 'quickbooks-items',
    group: 'QuickBooks items',
    titleKey: 'admin.catalogSettings.quickBooksItems',
    icon: 'link',
    fields: [
      { key: 'qbo.freight_item_id', labelKey: 'admin.catalogSettings.qboFreightItem' },
      { key: 'qbo.bad_debt_item_id', labelKey: 'admin.catalogSettings.qboBadDebtItem' },
      { key: 'qbo.refund_item_id', labelKey: 'admin.catalogSettings.qboRefundItem' },
      { key: 'qbo.refund_account_id', labelKey: 'admin.catalogSettings.qboRefundAccount' },
    ],
  },
];
