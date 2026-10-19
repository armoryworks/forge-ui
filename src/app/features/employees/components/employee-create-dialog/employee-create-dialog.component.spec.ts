import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';

import { environment } from '../../../../../environments/environment';
import { EmployeeCreateDialogComponent } from './employee-create-dialog.component';
import { CreatedEmployee } from '../../models/created-employee.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface DialogInternals {
  form: { invalid: boolean; patchValue(v: unknown): void };
  save(): void;
}

function setup() {
  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<EmployeeCreateDialogComponent, CreatedEmployee | null>;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new EmployeeCreateDialogComponent());
  return { component: component as unknown as DialogInternals, dialogRef, httpMock: TestBed.inject(HttpTestingController) };
}

describe('EmployeeCreateDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('needs a first and last name', () => {
    const { component } = setup();
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ firstName: 'Bea', lastName: 'Carter' });
    expect(component.form.invalid).toBe(false);
  });

  it('rejects a malformed work email', () => {
    const { component } = setup();
    component.form.patchValue({ firstName: 'Bea', lastName: 'Carter', workEmail: 'not-an-email' });
    expect(component.form.invalid).toBe(true);
  });

  it('save() POSTs the trimmed values, sends blanks as null and closes with the created record', () => {
    const { component, dialogRef, httpMock } = setup();
    component.form.patchValue({
      firstName: ' Bea ', lastName: 'Carter', department: 'Shipping', jobTitle: '  ',
      hireDate: new Date(2026, 9, 19), workEmail: 'bea@example.com',
    });

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      firstName: 'Bea',
      lastName: 'Carter',
      hireDate: '2026-10-19T00:00:00Z',
      department: 'Shipping',
      jobTitle: null,
      employeeNumber: null,
      workEmail: 'bea@example.com',
      phoneNumber: null,
    });
    req.flush({ id: 3, firstName: 'Bea', lastName: 'Carter' });

    expect(dialogRef.close).toHaveBeenCalledWith({ id: 3, firstName: 'Bea', lastName: 'Carter' });
  });

  it('a failed save keeps the dialog open', () => {
    const { component, dialogRef, httpMock } = setup();
    component.form.patchValue({ firstName: 'Bea', lastName: 'Carter' });

    component.save();
    httpMock.expectOne(`${environment.apiUrl}/employees`).flush({ title: 'Conflict' }, { status: 409, statusText: 'Conflict' });

    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
