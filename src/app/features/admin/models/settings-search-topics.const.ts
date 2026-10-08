import { SettingsSearchTopic } from './settings-search-topic.model';

export const SETTINGS_SEARCH_TOPICS: SettingsSearchTopic[] = [
  {
    highlight: 'numbering',
    titleKey: 'capabilityAreas.settingsSearch.numberingTitle',
    descKey: 'capabilityAreas.settingsSearch.numberingDesc',
    keywords: ['number', 'numbering', 'manual', 'prefix', 'sequence', 'autonumber'],
  },
  {
    highlight: 'company-profile',
    titleKey: 'capabilityAreas.settingsSearch.companyTitle',
    descKey: 'capabilityAreas.settingsSearch.companyDesc',
    keywords: ['company', 'business', 'profile', 'phone', 'fax', 'email', 'ein', 'tax id', 'website'],
  },
  {
    highlight: 'company-locations',
    titleKey: 'capabilityAreas.settingsSearch.locationsTitle',
    descKey: 'capabilityAreas.settingsSearch.locationsDesc',
    keywords: ['location', 'address', 'plant', 'warehouse', 'site', 'office'],
  },
  {
    highlight: 'jobs.default_priority',
    titleKey: 'capabilityAreas.settingsSearch.priorityTitle',
    descKey: 'capabilityAreas.settingsSearch.priorityDesc',
    keywords: ['priority', 'urgent'],
  },
  {
    highlight: 'branding',
    titleKey: 'capabilityAreas.settingsSearch.brandingTitle',
    descKey: 'capabilityAreas.settingsSearch.brandingDesc',
    keywords: ['logo', 'brand', 'branding', 'color', 'colour', 'theme', 'app name'],
  },
  {
    highlight: 'files.max_upload_size_mb',
    titleKey: 'capabilityAreas.settingsSearch.uploadTitle',
    descKey: 'capabilityAreas.settingsSearch.uploadDesc',
    keywords: ['upload', 'file size', 'attachment'],
  },
  {
    highlight: 'jobs.auto_archive_days',
    titleKey: 'capabilityAreas.settingsSearch.archiveTitle',
    descKey: 'capabilityAreas.settingsSearch.archiveDesc',
    keywords: ['archive'],
  },
  {
    highlight: 'notifications.email_enabled',
    titleKey: 'capabilityAreas.settingsSearch.notificationsTitle',
    descKey: 'capabilityAreas.settingsSearch.notificationsDesc',
    keywords: ['notification', 'notify', 'email', 'mention'],
  },
  {
    highlight: 'planning.cycle_duration_days',
    titleKey: 'capabilityAreas.settingsSearch.planningTitle',
    descKey: 'capabilityAreas.settingsSearch.planningDesc',
    keywords: ['planning', 'cycle'],
  },
  {
    highlight: 'pay-period',
    titleKey: 'capabilityAreas.settingsSearch.payPeriodTitle',
    descKey: 'capabilityAreas.settingsSearch.payPeriodDesc',
    keywords: ['pay period', 'lock', 'timesheet'],
  },
];

export function matchSettingsTopics(search: string): SettingsSearchTopic[] {
  const term = search.trim().toLowerCase();
  if (term.length < 3) return [];
  const words = term.split(/\s+/);
  return SETTINGS_SEARCH_TOPICS.filter((topic) =>
    topic.keywords.some((keyword) =>
      keyword.startsWith(term)
      || words.some((word) => word.startsWith(keyword))
      || (keyword.includes(' ') && term.includes(keyword))));
}
