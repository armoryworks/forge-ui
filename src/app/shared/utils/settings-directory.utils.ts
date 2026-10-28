import { SettingsDirectoryEntry } from '../models/settings-directory-entry.model';

/** The entries whose labels or screen name contain `query` (already trimmed and lower-cased) and that `canOpen` lets through. */
export function matchSettingsDirectory(
  entries: readonly SettingsDirectoryEntry[],
  query: string,
  text: (key: string) => string,
  canOpen: (entry: SettingsDirectoryEntry) => boolean,
): SettingsDirectoryEntry[] {
  if (query === '') return [];
  return entries.filter(entry =>
    [...entry.textKeys, entry.whereKey].some(key => text(key).toLowerCase().includes(query)) && canOpen(entry));
}
