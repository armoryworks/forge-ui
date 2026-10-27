import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

import { PendingChangesService } from '../services/pending-changes.service';

/** Leaving the route asks first while an embedded editor holds unsaved edits ({@link PendingChangesService}). */
export const pendingChangesGuard: CanDeactivateFn<unknown> = () => inject(PendingChangesService).confirmDiscard();
