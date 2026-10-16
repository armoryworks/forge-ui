import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { portalTerminologyGuard } from './portal-terminology.guard';
import { TerminologyService } from '../../../shared/services/terminology.service';

describe('portalTerminologyGuard', () => {
  it('loads the portal term set and never blocks navigation', () => {
    const terminology = { loadPortal: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: TerminologyService, useValue: terminology }] });

    const result = TestBed.runInInjectionContext(() =>
      portalTerminologyGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

    expect(result).toBe(true);
    expect(terminology.loadPortal).toHaveBeenCalledOnce();
  });
});
