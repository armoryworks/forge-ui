export type StressRole = 'production-worker' | 'engineer' | 'manager' | 'office' | 'admin';
export type TeamId = 'alpha' | 'bravo' | null;

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: StressRole;
  team: TeamId;
  trackType: string;
  workerId: number;
}

const PASSWORD = process.env.SEED_USER_PASSWORD || 'Test1234!';

export const STRESS_USERS: TestUser[] = [
  // First 6 workers cover every role type — enables short tests with MAX_WORKERS=6
  // to exercise all workflow code paths.

  // 1. Alpha production worker
  { email: 'bkelly@qbengineer.local', password: PASSWORD, firstName: 'Brian', lastName: 'Kelly', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 1 },
  // 2. Bravo maintenance worker
  { email: 'bravo1@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker1', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 2 },
  // 3. Engineer
  { email: 'akim@qbengineer.local', password: PASSWORD, firstName: 'Akim', lastName: 'Nakamura', role: 'engineer', team: null, trackType: 'all', workerId: 3 },
  // 4. Manager
  { email: 'lwilson@qbengineer.local', password: PASSWORD, firstName: 'Lisa', lastName: 'Wilson', role: 'manager', team: null, trackType: 'all', workerId: 4 },
  // 5. Office/Sales
  { email: 'cthompson@qbengineer.local', password: PASSWORD, firstName: 'Carol', lastName: 'Thompson', role: 'office', team: null, trackType: 'all', workerId: 5 },
  // 6. Admin
  { email: 'admin@qbengineer.local', password: PASSWORD, firstName: 'System', lastName: 'Admin', role: 'admin', team: null, trackType: 'all', workerId: 6 },

  // Remaining Alpha team (7-12)
  { email: 'alpha1@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker1', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 7 },
  { email: 'alpha2@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker2', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 8 },
  { email: 'alpha3@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker3', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 9 },
  { email: 'alpha4@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker4', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 10 },
  { email: 'alpha5@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker5', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 11 },
  { email: 'alpha6@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker6', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 12 },

  // Remaining Bravo team (13-18)
  { email: 'bravo2@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker2', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 13 },
  { email: 'bravo3@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker3', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 14 },
  { email: 'bravo4@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker4', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 15 },
  { email: 'bravo5@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker5', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 16 },
  { email: 'bravo6@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker6', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 17 },
  { email: 'bravo7@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker7', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 18 },

  // Remaining support roles (19-20)
  { email: 'dhart@qbengineer.local', password: PASSWORD, firstName: 'Derek', lastName: 'Hart', role: 'engineer', team: null, trackType: 'all', workerId: 19 },
  { email: 'rchavez@qbengineer.local', password: PASSWORD, firstName: 'Rosa', lastName: 'Chavez', role: 'manager', team: null, trackType: 'all', workerId: 20 },
];

export function getUsersByRole(role: StressRole): TestUser[] {
  return STRESS_USERS.filter(u => u.role === role);
}

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4200';
export const API_URL = process.env.E2E_API_URL || 'http://localhost:5000';
export const STRESS_DURATION_MS = parseInt(process.env.E2E_STRESS_DURATION || '5400000', 10); // 90 min default
export const MAX_WORKERS = parseInt(process.env.E2E_MAX_WORKERS || '20', 10); // limit concurrent workers
