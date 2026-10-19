import { ROLE_LANDING } from './role-landing.model';
import { ROUTE_ACCESS, routeAccessFor } from './route-access.model';
import { routeAccessGuards } from '../guards/route-access.guard';

describe('ROUTE_ACCESS', () => {
  it('resolves the longest gated prefix of a URL', () => {
    expect(routeAccessFor('/accounting/opening-journal?x=1')).toBe(ROUTE_ACCESS['accounting/opening-journal']);
    expect(routeAccessFor('/accounting/ledger')).toBe(ROUTE_ACCESS['accounting']);
    expect(routeAccessFor('/parts/12#notes')).toBe(ROUTE_ACCESS['parts']);
    expect(routeAccessFor('/dashboard')).toBeUndefined();
    expect(routeAccessFor('/')).toBeUndefined();
  });

  it('sends every single-role landing to a route that admits that role', () => {
    for (const [role, target] of Object.entries(ROLE_LANDING)) {
      const roles = routeAccessFor(target)?.roles;
      if (roles) expect(roles, `${role} -> ${target}`).toContain(role);
    }
  });

  it('gates the board on the roles the jobs API admits', () => {
    expect([...(ROUTE_ACCESS['kanban'].roles ?? [])].sort()).toEqual(
      ['Admin', 'Engineer', 'Manager', 'OfficeManager', 'PM', 'ProductionWorker']);
  });

  it('builds a role guard then a capability guard from an entry', () => {
    expect(routeAccessGuards('parts')).toHaveLength(1);
    expect(routeAccessGuards('accounting')).toHaveLength(2);
  });

  it('refuses to build guards for a route with no entry', () => {
    expect(() => routeAccessGuards('no-such-route')).toThrow();
  });
});
