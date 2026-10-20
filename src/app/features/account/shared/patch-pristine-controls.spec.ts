import { describe, it, expect } from 'vitest';
import { FormControl, FormGroup } from '@angular/forms';

import { patchPristineControls } from './patch-pristine-controls';

describe('patchPristineControls', () => {
  it('fills untouched controls and keeps what the user already typed', () => {
    const form = new FormGroup({
      dateOfBirth: new FormControl<string | null>(null),
      gender: new FormControl<string | null>(null),
    });
    form.controls.gender.setValue('Male');
    form.controls.gender.markAsDirty();

    patchPristineControls(form, { dateOfBirth: '1990-02-28', gender: 'Female' });

    expect(form.getRawValue()).toEqual({ dateOfBirth: '1990-02-28', gender: 'Male' });
  });
});
