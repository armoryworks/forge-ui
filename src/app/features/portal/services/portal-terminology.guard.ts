import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

import { TerminologyService } from '../../../shared/services/terminology.service';

export const portalTerminologyGuard: CanActivateFn = () => {
  inject(TerminologyService).loadPortal();
  return true;
};
