import { SettingsDirectoryEntry } from '../../../shared/models/settings-directory-entry.model';
import { SETTINGS_SEARCH_INDEX } from './settings-search-index.const';

/** The sections of Admin > Settings as settings-search entries, each opening the tab on that section. */
export const ADMIN_SETTINGS_DIRECTORY: SettingsDirectoryEntry[] = SETTINGS_SEARCH_INDEX.map(section => ({
  key: section.key,
  textKeys: section.textKeys,
  whereKey: 'admin.tabs.settings',
  route: '/admin/settings',
  queryParams: { highlight: section.key },
  access: { roles: ['Admin'] },
}));
