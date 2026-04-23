import { DemoDataStore } from '../services/demo-data-store.service';

type Row = Record<string, unknown> & { id?: number | string };

/**
 * Synthesizes responses for non-CRUD aggregate endpoints (dashboard, search,
 * reports, counts, etc.) that don't map 1:1 to a demo-data JSON file. These
 * are cheap, in-browser computations over the loaded store — not a full
 * re-implementation of the backend.
 *
 * Returns `undefined` if the path isn't a recognized aggregate — the caller
 * should fall back to the generic entity handler.
 */
export async function synthesizeAggregate(
  store: DemoDataStore,
  method: string,
  path: string,
): Promise<unknown | undefined> {
  // Normalize — strip any ?query, coalesce dashboards/dashboard/layout etc.
  const p = path.replace(/^\/+/, '').replace(/^api\/v\d+\//, '').split('?')[0];
  const segs = p.split('/').filter(Boolean);

  if (segs.length === 0) return undefined;

  const head = segs[0];
  const sub = segs[1];

  if (head === 'dashboard') {
    if (method !== 'GET') return {};
    if (!sub) return synthesizeDashboard(store);
    if (sub === 'layout') return { widgets: [] };
    if (sub === 'margin-summary') return { entries: [] };
    if (sub === 'open-orders') return { orders: [] };
    return {};
  }

  if (head === 'search' && method === 'GET') {
    return { results: [], total: 0 };
  }

  if (head === 'reports' && method === 'GET') {
    // All the report endpoints return arrays of rows. Empty is safe.
    return [];
  }

  if (head === 'approvals' && method === 'GET') {
    if (sub === 'pending' || sub === 'history' || sub === 'workflows') return [];
    return [];
  }

  if (head === 'notifications' && method === 'GET') {
    if (sub === 'preferences') return { preferences: [] };
    // Fall through — /notifications maps to the notification file via DEMO_URL_MAP.
    return undefined;
  }

  if (head === 'profile' || head === 'employee-profile') {
    if (method === 'GET') {
      if (sub === 'completeness') return { percent: 100, missing: [] };
      return demoProfile();
    }
    return demoProfile();
  }

  if (head === 'accounting' && method === 'GET') {
    if (sub === 'providers') return [];
    if (sub === 'sync-status') return { queued: 0, lastRun: null, errors: 0 };
    if (sub === 'employees' || sub === 'items') return [];
    return null;
  }

  if (head === 'admin') {
    if (method !== 'GET') return {};
    if (sub === 'company-profile') return companyProfile();
    if (sub === 'brand') return { name: 'QB Engineer Demo', logoUrl: null, primaryColor: '#0d9488' };
    if (sub === 'system-settings') {
      const settings = await store.load('system-setting');
      return settings;
    }
    if (sub === 'integration-outbox' || sub === 'domain-event-failures' || sub === 'audit-log') return [];
    if (sub === 'storage-usage') return { totalBytes: 0, buckets: [] };
    if (sub === 'integrations') return [];
    if (sub === 'mfa') return { enforced: false, policies: [] };
    if (sub === 'accounting-mode') return { mode: 'standalone', providerId: null, isConfigured: false };
    if (sub === 'users') {
      const users = await store.load('application-user');
      return users;
    }
    if (sub === 'roles') {
      return [
        { id: 1, name: 'Admin' },
        { id: 2, name: 'Manager' },
        { id: 3, name: 'Engineer' },
        { id: 4, name: 'OfficeManager' },
        { id: 5, name: 'ProductionWorker' },
      ];
    }
    if (sub === 'reference-data') {
      return await store.load('reference-data');
    }
    if (sub === 'track-types') {
      return await store.load('track-type');
    }
    return {};
  }

  if (head === 'quickbooks' && method === 'GET') {
    if (sub === 'status') return { connected: false, realmId: null };
    return {};
  }

  if (head === 'onboarding' && method === 'GET') {
    return { completed: true, currentStep: 'done' };
  }

  if (head === 'planning-cycles' && method === 'GET') {
    // /planning-cycles/current — dashboard widget calls getTime() on endDate,
    // so return null rather than letting the generic handler yield [].
    if (sub === 'current') return null;
    return undefined; // Let generic handler return the list.
  }

  if (head === 'scheduled-tasks' && method === 'GET') return [];
  if (head === 'follow-up-tasks' && method === 'GET') return [];
  if (head === 'holds' && method === 'GET') return [];
  if (head === 'auto-po' && method === 'GET') return { suggestions: [] };
  if (head === 'replenishment' && method === 'GET') return { items: [] };
  if (head === 'mrp' && method === 'GET') return { runs: [], plannedOrders: [] };
  if (head === 'shop-floor' && method === 'GET') return { activeJobs: [], workers: [] };
  if (head === 'display' && method === 'GET') return { jobs: [], alerts: [] };
  if (head === 'scanner' && method === 'GET') return { devices: [] };

  return undefined;
}

async function synthesizeDashboard(store: DemoDataStore): Promise<unknown> {
  const [jobs, users, stages, activity] = await Promise.all([
    store.load('job'),
    store.load('application-user'),
    store.load('job-stage'),
    store.load('job-activity-log'),
  ]);

  const now = Date.now();
  const isArchivedDisposition = (d: unknown): boolean => {
    const s = String(d ?? '').toLowerCase();
    return s === 'archived' || s === 'cancelled' || s === 'completed' || s === 'shipped';
  };

  const activeJobs = jobs.filter(j => !isArchivedDisposition(j['disposition']));
  const overdueJobs = activeJobs.filter(j => {
    const d = j['dueDate'];
    if (!d) return false;
    const t = new Date(String(d)).getTime();
    return !isNaN(t) && t < now;
  });

  const stageCounts = new Map<number | string, number>();
  for (const job of activeJobs) {
    const sid = job['jobStageId'] ?? job['stageId'];
    if (sid !== undefined && sid !== null) {
      stageCounts.set(sid as number, (stageCounts.get(sid as number) ?? 0) + 1);
    }
  }
  const maxStageCount = Math.max(1, ...Array.from(stageCounts.values()));

  const stageList = stages.slice(0, 10).map(s => ({
    label: String(s['name'] ?? 'Stage'),
    count: stageCounts.get(s['id'] as number) ?? 0,
    color: String(s['color'] ?? '#0d9488'),
    maxCount: maxStageCount,
  }));

  const userCounts = new Map<number | string, number>();
  for (const j of activeJobs) {
    const uid = j['assigneeId'] ?? j['assignedToId'];
    if (uid !== undefined && uid !== null) {
      userCounts.set(uid as number, (userCounts.get(uid as number) ?? 0) + 1);
    }
  }
  const maxUserCount = Math.max(1, ...Array.from(userCounts.values()));

  const teamList = Array.from(userCounts.entries())
    .slice(0, 8)
    .map(([uid, count]) => {
      const u = users.find(x => String(x['id']) === String(uid));
      const first = String(u?.['firstName'] ?? '').trim();
      const last = String(u?.['lastName'] ?? '').trim();
      const initials = ((first[0] ?? '?') + (last[0] ?? '')).toUpperCase();
      const name = last && first ? `${last}, ${first}` : first || last || 'Unknown';
      return {
        initials,
        name,
        color: String(u?.['avatarColor'] ?? '#64748b'),
        taskCount: count,
        maxTasks: maxUserCount,
      };
    });

  return {
    tasks: buildTasks(activeJobs, users),
    stages: stageList,
    team: teamList,
    activity: activity
      .slice(-10)
      .reverse()
      .map((a: Row) => ({
        icon: 'info',
        iconColor: '#0d9488',
        text: String(a['description'] ?? a['action'] ?? 'Activity'),
        time: String(a['createdAt'] ?? ''),
      })),
    deadlines: overdueJobs.slice(0, 8).map((j: Row) => ({
      date: String(j['dueDate'] ?? ''),
      jobNumber: String(j['jobNumber'] ?? `#${j['id']}`),
      description: String(j['title'] ?? ''),
      isOverdue: true,
    })),
    kpis: {
      activeCount: activeJobs.length,
      activeChange: 0,
      overdueCount: overdueJobs.length,
      overdueChange: 0,
      totalHours: '0',
      hoursStatus: 'stable',
    },
  };
}

function buildTasks(activeJobs: Row[], users: Row[]): unknown[] {
  return activeJobs.slice(0, 6).map((j: Row) => {
    const uid = j['assigneeId'] ?? j['assignedToId'];
    const u = users.find(x => String(x['id']) === String(uid));
    const first = String(u?.['firstName'] ?? '').trim();
    const last = String(u?.['lastName'] ?? '').trim();
    const initials = ((first[0] ?? '?') + (last[0] ?? '')).toUpperCase();
    return {
      id: j['id'],
      time: '',
      title: String(j['title'] ?? `Job #${j['id']}`),
      jobNumber: String(j['jobNumber'] ?? `#${j['id']}`),
      barColor: '#0d9488',
      assignee: { initials, color: String(u?.['avatarColor'] ?? '#64748b') },
      status: String(j['disposition'] ?? 'In Progress'),
      statusColor: 'active' as const,
    };
  });
}

function demoProfile(): unknown {
  return {
    id: 1,
    firstName: 'Demo',
    lastName: 'Viewer',
    email: 'demo@qb-engineer.com',
    phone: null,
    avatarColor: '#0d9488',
    initials: 'DV',
    workLocationId: null,
  };
}

function companyProfile(): unknown {
  return {
    name: 'QB Engineer Demo Co.',
    phone: '(555) 555-0100',
    email: 'contact@qb-engineer.example',
    ein: null,
    website: 'https://qb-engineer.com',
  };
}
