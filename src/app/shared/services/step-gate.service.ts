import { Injectable, computed, inject } from '@angular/core';

import { AuthService } from './auth.service';
import { CapabilityService } from './capability.service';
import { OperationGate } from '../models/operation-gate.model';
import { STEP_GATE_OVERRIDE_ROLES } from '../models/step-gate-override-roles.const';
import { StepGatingMode } from '../models/step-gating-mode.type';

@Injectable({ providedIn: 'root' })
export class StepGateService {
  static readonly OVERRIDE_CAPABILITY = 'CAP-MFG-GATE-OVERRIDE';

  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);

  readonly canOverride = computed(() => {
    this.auth.user();
    return this.auth.hasAnyRole([...STEP_GATE_OVERRIDE_ROLES])
      && this.capabilities.isEnabled(StepGateService.OVERRIDE_CAPABILITY, true);
  });

  gateFor(
    row: { available?: number | null; availableFromStep?: number | null; waitingOnSteps?: number[] | null },
    mode: StepGatingMode | null | undefined,
  ): OperationGate | null {
    if (!mode || mode === 'Off') return null;
    return {
      mode,
      available: row.available ?? null,
      availableFromStep: row.availableFromStep ?? null,
      waitingOnSteps: row.waitingOnSteps ?? [],
      canOverride: mode === 'Warn' || this.canOverride(),
    };
  }
}
