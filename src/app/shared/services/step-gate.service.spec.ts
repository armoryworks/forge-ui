import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { StepGateService } from './step-gate.service';
import { AuthService } from './auth.service';
import { CapabilityService } from './capability.service';

function setup(roles: string[], overrideOn = true): StepGateService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { user: signal({ id: 1 }), hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      { provide: CapabilityService, useValue: { isEnabled: vi.fn(() => overrideOn) } },
    ],
  });
  return TestBed.inject(StepGateService);
}

const row = { available: 12, availableFromStep: 10, waitingOnSteps: [20] };

describe('StepGateService', () => {
  it('has nothing to say when gating is off', () => {
    expect(setup(['Manager']).gateFor(row, 'Off')).toBeNull();
    expect(setup(['Manager']).gateFor(row, undefined)).toBeNull();
  });

  it('lets anyone acknowledge a warning', () => {
    expect(setup(['ProductionWorker']).gateFor(row, 'Warn')).toEqual({
      mode: 'Warn', available: 12, availableFromStep: 10, waitingOnSteps: [20], canOverride: true,
    });
  });

  it('lets only supervisors override a block, and only with the capability on', () => {
    expect(setup(['ProductionWorker']).gateFor(row, 'Block')?.canOverride).toBe(false);
    expect(setup(['Production Manager']).gateFor(row, 'Block')?.canOverride).toBe(true);
    expect(setup(['Manager'], false).gateFor(row, 'Block')?.canOverride).toBe(false);
  });
});
