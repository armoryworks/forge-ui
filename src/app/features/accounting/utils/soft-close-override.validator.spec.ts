import { describe, expect, it } from 'vitest';
import { FormControl, FormGroup } from '@angular/forms';

import { FiscalPeriodStatus } from '../models/accounting.models';
import { softCloseOverrideValidator } from './soft-close-override.validator';

function group(status: FiscalPeriodStatus | null, ticked: boolean, reason: string): FormGroup {
  return new FormGroup(
    { overrideSoftClose: new FormControl(ticked), overrideReason: new FormControl(reason) },
    { validators: [softCloseOverrideValidator(() => status, { hardClosed: () => 'hard', overrideRequired: () => 'soft' })] },
  );
}

describe('softCloseOverrideValidator', () => {
  it('lets an open period or an unknown date through', () => {
    expect(group('Open', false, '').errors).toBeNull();
    expect(group(null, false, '').errors).toBeNull();
  });

  it('needs the override and a reason for a soft-closed period', () => {
    expect(group('SoftClosed', false, '').errors).toEqual({ softClosedOverrideRequired: { message: 'soft' } });
    expect(group('SoftClosed', true, '  ').errors).toEqual({ softClosedOverrideRequired: { message: 'soft' } });
    expect(group('SoftClosed', true, 'Late invoice').errors).toBeNull();
  });

  it('never lets a hard-closed period through', () => {
    expect(group('HardClosed', true, 'Please').errors).toEqual({ periodHardClosed: { message: 'hard' } });
  });
});
