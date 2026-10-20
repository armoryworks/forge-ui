const ADMIN_ONLY: readonly string[] = ['Admin'];
const ADMIN_AND_MANAGER: readonly string[] = ['Admin', 'Manager'];

/** Admin tabs only some roles may open, with the roles that may open each. A tab not listed is open to every role the admin area admits. */
export const ADMIN_TAB_ROLES: Readonly<Record<string, readonly string[]>> = {
  'overview': ADMIN_ONLY,
  'users': ADMIN_ONLY,
  'track-types': ADMIN_ONLY,
  'reference-data': ADMIN_ONLY,
  'terminology': ADMIN_ONLY,
  'settings': ADMIN_ONLY,
  'integrations': ADMIN_ONLY,
  'ai-assistants': ADMIN_ONLY,
  'teams': ADMIN_ONLY,
  'role-templates': ADMIN_ONLY,
  'sales-tax': ADMIN_ONLY,
  'audit-log': ADMIN_ONLY,
  'edi': ADMIN_ONLY,
  'mfa': ADMIN_ONLY,
  'automations': ADMIN_ONLY,
  'auto-po': ADMIN_ONLY,
  'integration-outbox': ADMIN_ONLY,
  'expenses': ADMIN_ONLY,
  'banking': ADMIN_ONLY,
  'bi-api-keys': ADMIN_ONLY,
  'system-api-keys': ADMIN_ONLY,
  'connections': ADMIN_ONLY,
  'training': ADMIN_AND_MANAGER,
  'time-corrections': ADMIN_AND_MANAGER,
  'events': ADMIN_AND_MANAGER,
  'announcements': ADMIN_AND_MANAGER,
};
