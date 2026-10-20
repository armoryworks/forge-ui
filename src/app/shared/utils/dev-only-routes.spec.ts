import { Routes } from '@angular/router';

import { devOnlyRoutes } from './dev-only-routes';

describe('devOnlyRoutes', () => {
  const routes: Routes = [{ path: 'dev-tools' }];

  it('keeps the routes in a development build', () => {
    expect(devOnlyRoutes(routes, false)).toBe(routes);
  });

  it('drops the routes from a production build', () => {
    expect(devOnlyRoutes(routes, true)).toEqual([]);
  });
});
