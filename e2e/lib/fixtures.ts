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
  // Alpha team — Production workers (1-7)
  { email: 'bkelly@qbengineer.local', password: PASSWORD, firstName: 'Brian', lastName: 'Kelly', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 1 },
  { email: 'alpha1@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker1', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 2 },
  { email: 'alpha2@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker2', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 3 },
  { email: 'alpha3@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker3', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 4 },
  { email: 'alpha4@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker4', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 5 },
  { email: 'alpha5@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker5', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 6 },
  { email: 'alpha6@qbengineer.local', password: PASSWORD, firstName: 'Alpha', lastName: 'Worker6', role: 'production-worker', team: 'alpha', trackType: 'Production', workerId: 7 },

  // Bravo team — Maintenance workers (8-14)
  { email: 'bravo1@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker1', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 8 },
  { email: 'bravo2@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker2', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 9 },
  { email: 'bravo3@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker3', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 10 },
  { email: 'bravo4@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker4', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 11 },
  { email: 'bravo5@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker5', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 12 },
  { email: 'bravo6@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker6', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 13 },
  { email: 'bravo7@qbengineer.local', password: PASSWORD, firstName: 'Bravo', lastName: 'Worker7', role: 'production-worker', team: 'bravo', trackType: 'Maintenance', workerId: 14 },

  // Support roles (15-20)
  { email: 'akim@qbengineer.local', password: PASSWORD, firstName: 'Akim', lastName: 'Nakamura', role: 'engineer', team: null, trackType: 'all', workerId: 15 },
  { email: 'dhart@qbengineer.local', password: PASSWORD, firstName: 'Derek', lastName: 'Hart', role: 'engineer', team: null, trackType: 'all', workerId: 16 },
  { email: 'lwilson@qbengineer.local', password: PASSWORD, firstName: 'Lisa', lastName: 'Wilson', role: 'manager', team: null, trackType: 'all', workerId: 17 },
  { email: 'rchavez@qbengineer.local', password: PASSWORD, firstName: 'Rosa', lastName: 'Chavez', role: 'manager', team: null, trackType: 'all', workerId: 18 },
  { email: 'cthompson@qbengineer.local', password: PASSWORD, firstName: 'Carol', lastName: 'Thompson', role: 'office', team: null, trackType: 'all', workerId: 19 },
  { email: 'admin@qbengineer.local', password: PASSWORD, firstName: 'System', lastName: 'Admin', role: 'admin', team: null, trackType: 'all', workerId: 20 },
];

export function getUsersByRole(role: StressRole): TestUser[] {
  return STRESS_USERS.filter(u => u.role === role);
}

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4200';
export const API_URL = process.env.E2E_API_URL || 'http://localhost:5000';
export const STRESS_DURATION_MS = parseInt(process.env.E2E_STRESS_DURATION || '5400000', 10); // 90 min default
