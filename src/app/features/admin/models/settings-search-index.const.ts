import { CATALOG_SETTING_SECTIONS } from './catalog-setting-sections.const';

export const SETTINGS_SEARCH_INDEX: { key: string; textKeys: string[] }[] = [
  { key: 'company-profile', textKeys: ['admin.companyProfile', 'admin.companyName', 'common.phone', 'common.email', 'admin.ein', 'admin.website', 'admin.companyTimeZone'] },
  { key: 'company-locations', textKeys: ['admin.locations', 'admin.newLocation'] },
  { key: 'pay-period', textKeys: ['admin.payPeriod', 'admin.lockPeriodHint'] },
  { key: 'telemetry', textKeys: ['admin.telemetry.title', 'admin.telemetry.description'] },
  { key: 'numbering', textKeys: ['admin.numbering.title'] },
  { key: 'shop-floor', textKeys: ['admin.shopFloor.title'] },
  { key: 'branding', textKeys: ['admin.companyLogo', 'admin.logoDescription'] },
  { key: 'lockups', textKeys: ['admin.brandLockups', 'admin.brandLockupsDescription'] },
  ...CATALOG_SETTING_SECTIONS.map(section => ({ key: section.key, textKeys: [section.titleKey, ...section.fields.map(field => field.labelKey)] })),
];
