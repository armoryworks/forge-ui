/**
 * Phase 1m — UI shape returned from GET /admin/settings. The server
 * masks secrets in the value field (the placeholder string "••••••••")
 * so the UI never sees the plaintext after the initial save. `hasValue`
 * tells us whether to show "(default)" inline next to the input.
 */
export interface SettingsCatalogEntry {
  key: string;
  group: string;
  displayName: string;
  description: string | null;
  dataType: 'String' | 'Secret' | 'Boolean' | 'Integer' | 'Url' | 'Json' | 'Enum';
  defaultValue: string | null;
  isSecret: boolean;
  isRequired: boolean;
  sortOrder: number;
  /** Current effective value — masked for secrets, default value for unset non-secrets. */
  value: string | null;
  /** True when an admin has overridden the default. */
  hasValue: boolean;
  choices: { value: string; label: string }[] | null;
}
