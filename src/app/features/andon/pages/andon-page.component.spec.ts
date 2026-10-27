import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ROUTE_ACCESS } from '../../../shared/models/route-access.model';
import { AuthService } from '../../../shared/services/auth.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { NavTreeService } from '../../../shared/services/nav-tree.service';
import { ANDON_ROUTES } from '../andon.routes';
import { AndonPageComponent } from './andon-page.component';

function routesFor(roles: string[], enabled: (code: string) => boolean): string[] {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CapabilityService, useValue: { isEnabled: enabled } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)), user: () => null } },
    ],
  });
  return TestBed.inject(NavTreeService).flatLeaves().map(leaf => leaf.route);
}

describe('AndonPageComponent', () => {
  it('is the page the andon route opens', () => {
    expect(ANDON_ROUTES[0].component).toBe(AndonPageComponent);
  });

  it('is gated on the andon capability and open to every signed-in role, as the API is', () => {
    expect(ROUTE_ACCESS['andon']).toEqual({ capabilities: ['CAP-EXT-ANDON'] });
  });

  it('shows the Andon menu entry to floor and office roles while andon is on', () => {
    expect(routesFor(['ProductionWorker'], () => true)).toContain('/andon');
    expect(routesFor(['Manager'], () => true)).toContain('/andon');
  });

  it('hides the Andon menu entry when andon is off', () => {
    expect(routesFor(['Manager'], code => code !== 'CAP-EXT-ANDON')).not.toContain('/andon');
  });
});
