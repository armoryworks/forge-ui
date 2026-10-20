import { Routes } from '@angular/router';

import { environment } from '../../../environments/environment';

/** The given developer and demo routes in a development build; none in a production build. */
export function devOnlyRoutes(routes: Routes, production = environment.production): Routes {
  return production ? [] : routes;
}
