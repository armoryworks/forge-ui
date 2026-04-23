/**
 * URL path → demo-data file stem map.
 *
 * Left side: the first meaningful segment of the request path (leading slash and
 * "api/v1" stripped), e.g. the `/jobs/42/subtasks` request uses key "jobs".
 *
 * Right side: the file stem under /demo-data/ (no ".json").
 *
 * Entities missing from this map fall through to an empty-array response so the
 * UI renders an empty state rather than erroring.
 */
export const DEMO_URL_MAP: Readonly<Record<string, string>> = Object.freeze({
  jobs: 'job',
  'job-stages': 'job-stage',
  'job-subtasks': 'job-subtask',
  'job-notes': 'job-note',
  'job-links': 'job-link',
  'job-activity': 'job-activity-log',
  'track-types': 'track-type',

  parts: 'part',
  'part-alternates': 'part-alternate',
  'part-prices': 'part-price',
  'part-revisions': 'part-revision',
  bom: 'bomentry',
  operations: 'operation',

  inventory: 'bin-content',
  'storage-locations': 'storage-location',
  'bin-movements': 'bin-movement',
  'cycle-counts': 'cycle-count',

  customers: 'customer',
  'customer-addresses': 'customer-address',
  'customer-returns': 'customer-return',
  contacts: 'contact',
  'contact-interactions': 'contact-interaction',

  vendors: 'vendor',
  'vendor-scorecards': 'vendor-scorecard',

  quotes: 'quote',
  'quote-lines': 'quote-line',
  estimates: 'quote',
  'sales-orders': 'sales-order',
  'sales-order-lines': 'sales-order-line',
  'purchase-orders': 'purchase-order',
  'purchase-order-lines': 'purchase-order-line',
  shipments: 'shipment',
  'shipment-lines': 'shipment-line',
  invoices: 'invoice',
  'invoice-lines': 'invoice-line',
  payments: 'payment',
  'price-lists': 'price-list',
  'recurring-orders': 'recurring-order',

  leads: 'lead',
  expenses: 'expense',
  assets: 'asset',
  'time-entries': 'time-entry',
  'clock-events': 'clock-event',
  'time-corrections': 'time-correction-log',

  users: 'application-user',
  employees: 'application-user',
  'employee-profiles': 'employee-profile',
  teams: 'team',
  shifts: 'shift',

  'pay-stubs': 'pay-stub',
  'tax-documents': 'tax-document',
  'compliance-forms': 'compliance-form-template',
  'compliance-submissions': 'compliance-form-submission',

  notifications: 'notification',
  announcements: 'announcement',
  events: 'event',
  'event-attendees': 'event-attendee',

  chat: 'chat-message',
  'chat-rooms': 'chat-room',
  'chat-messages': 'chat-message',

  'reference-data': 'reference-data',
  'system-settings': 'system-setting',
  'company-locations': 'company-location',
  terminology: 'terminology-entry',

  'planning-cycles': 'planning-cycle',
  'planning-cycle-entries': 'planning-cycle-entry',

  training: 'training-module',
  'training-modules': 'training-module',
  'training-paths': 'training-path',
  'training-progress': 'training-progress',

  quality: 'qc-inspection',
  'qc-inspections': 'qc-inspection',
  'qc-templates': 'qc-checklist-template',
  lots: 'lot-record',
  'non-conformances': 'non-conformance',

  'production-runs': 'production-run',
  'work-centers': 'work-center',
  machines: 'machine-connection',

  'request-for-quotes': 'request-for-quote',
  rfqs: 'request-for-quote',

  'ai-assistants': 'ai-assistant',

  approvals: 'approval-request',
  'approval-workflows': 'approval-workflow',

  'mrp-runs': 'mrp-run',
  'mrp-planned-orders': 'mrp-planned-order',
  'master-schedules': 'master-schedule',

  files: 'file-attachment',

  'user-preferences': 'user-preference',
  'saved-reports': 'saved-report',

  edi: 'edi-trading-partner',
  'edi-transactions': 'edi-transaction',
});

/** Resolve `/api/v1/jobs/42/subtasks` → `{ key: 'jobs', file: 'job', rest: ['42','subtasks'] }`. */
export function resolveDemoPath(url: string): { key: string; file: string | null; rest: string[] } | null {
  try {
    const pathname = url.startsWith('http')
      ? new URL(url).pathname
      : url.split('?')[0];
    const stripped = pathname.replace(/^\/+/, '').replace(/^api\/v\d+\//, '');
    if (!stripped) return null;
    const parts = stripped.split('/');
    const key = parts[0];
    const file = DEMO_URL_MAP[key] ?? null;
    return { key, file, rest: parts.slice(1) };
  } catch {
    return null;
  }
}
