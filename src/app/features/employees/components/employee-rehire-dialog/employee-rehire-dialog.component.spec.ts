import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmployeeRehireDialogComponent } from './employee-rehire-dialog.component';

interface RehireView {
  form: { patchValue(v: unknown): void };
  applied: boolean;
  save(): void;
}

function setup(appliedAt: string | null) {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { employee: { id: 7, firstName: 'Bo', lastName: 'Ng', termination: { appliedAt } }, kind: 'profile' } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new EmployeeRehireDialogComponent()) as unknown as RehireView;
  return { view, close, http: TestBed.inject(HttpTestingController) };
}

describe('EmployeeRehireDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('rehires with the chosen date', () => {
    const { view, close, http } = setup('2026-10-07T14:00:00Z');
    expect(view.applied).toBe(true);
    view.form.patchValue({ rehireDate: new Date(2026, 11, 1) });
    view.save();
    const req = http.expectOne(r => r.url === `${environment.apiUrl}/employees/7/rehire`);
    expect(req.request.params.get('kind')).toBe('profile');
    expect(req.request.body).toEqual({ rehireDate: '2026-12-01T00:00:00Z' });
    req.flush(null);
    expect(close).toHaveBeenCalledWith(true);
  });

  it('cancels a scheduled termination without a date', () => {
    const { view, http } = setup(null);
    expect(view.applied).toBe(false);
    view.save();
    expect(http.expectOne(`${environment.apiUrl}/employees/7/rehire?kind=profile`).request.body).toEqual({ rehireDate: null });
  });
});
