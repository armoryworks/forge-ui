import { TranslateService } from '@ngx-translate/core';

import { TOLERANCE_OVERRIDE_ROLES } from '../models/tolerance-override-roles.const';
import { AuthService } from '../services/auth.service';

/** The info text of an over-tolerance field: the base hint, plus who may raise the value when the user may not. */
export function overToleranceInfo(translate: TranslateService, auth: AuthService, baseKey?: string): string {
  const base = baseKey ? String(translate.instant(baseKey)) : '';
  if (auth.hasAnyRole([...TOLERANCE_OVERRIDE_ROLES])) return base;
  const restriction = String(translate.instant('tolerance.raiseNeedsManager'));
  return base ? `${base} ${restriction}` : restriction;
}
