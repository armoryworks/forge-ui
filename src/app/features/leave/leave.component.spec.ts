import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { LeaveComponent } from './leave.component';
import { AuthService } from '../../shared/services/auth.service';

interface LeaveInternals {
  tabs: () => { key: string }[];
  canDecide: () => boolean;
  isAdmin: () => boolean;
}

function setup(roles: string[]) {
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tab: 'mine' })) } },
      { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      {
        provide: AuthService,
        useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)), hasRole: (r: string) => roles.includes(r) },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => new LeaveComponent()) as unknown as LeaveInternals;
}

describe('LeaveComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows a production worker only their own leave', () => {
    const c = setup(['ProductionWorker']);
    expect(c.tabs().map(t => t.key)).toEqual(['mine']);
    expect(c.canDecide()).toBe(false);
  });

  it('gives payroll roles every tab but no approve or adjust rights', () => {
    for (const role of ['OfficeManager', 'Controller']) {
      TestBed.resetTestingModule();
      const c = setup([role]);
      expect(c.tabs().map(t => t.key)).toEqual(['mine', 'team', 'balances', 'policies']);
      expect(c.canDecide()).toBe(false);
      expect(c.isAdmin()).toBe(false);
    }
  });

  it('lets a manager decide and an admin also adjust', () => {
    expect(setup(['Manager']).canDecide()).toBe(true);
    TestBed.resetTestingModule();
    const admin = setup(['Admin']);
    expect(admin.canDecide()).toBe(true);
    expect(admin.isAdmin()).toBe(true);
  });
});
