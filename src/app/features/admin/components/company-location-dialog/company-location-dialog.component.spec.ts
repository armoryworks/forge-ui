import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CompanyLocationDialogComponent } from './company-location-dialog.component';
import { WorkingCalendarsService } from '../../services/working-calendars.service';
import { CompanyLocation } from '../../models/company-location.model';

interface DialogApi {
  form: FormGroup;
  calendarOptions: () => { value: unknown; label: string }[];
  isEdit: () => boolean;
  save(): void;
  saved: { subscribe(fn: (value: Partial<CompanyLocation>) => void): void };
  dialogRef: { clearDraft(): void };
  ngOnInit(): void;
}

const location: CompanyLocation = {
  id: 4,
  name: 'North plant',
  line1: '1 Main St',
  line2: null,
  city: 'Ogden',
  state: 'UT',
  postalCode: '84401',
  country: 'US',
  phone: null,
  isDefault: false,
  isActive: true,
  workingCalendarId: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function create(existing: CompanyLocation | null): { api: DialogApi; emitted: Partial<CompanyLocation>[] } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: WorkingCalendarsService,
        useValue: {
          list: () => of([
            { id: 1, name: 'Plant', timeZone: 'America/Denver', isActive: true },
            { id: 2, name: 'Weekend crew', timeZone: 'America/Denver', isActive: false },
            { id: 3, name: 'Retired', timeZone: 'UTC', isActive: false },
          ]),
        },
      },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  TestBed.overrideComponent(CompanyLocationDialogComponent, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(CompanyLocationDialogComponent);
  fixture.componentRef.setInput('location', existing);
  const api = fixture.componentInstance as unknown as DialogApi;
  api.dialogRef = { clearDraft: vi.fn() };
  api.ngOnInit();
  const emitted: Partial<CompanyLocation>[] = [];
  api.saved.subscribe(value => emitted.push(value));
  return { api, emitted };
}

describe('CompanyLocationDialogComponent', () => {
  it('opens an existing location in edit mode with its fields and calendar', () => {
    const { api } = create(location);

    expect(api.isEdit()).toBe(true);
    expect(api.form.value.name).toBe('North plant');
    expect(api.form.value.workingCalendarId).toBe(2);
  });

  it('offers the company default, the active calendars and the one already assigned', () => {
    const { api } = create(location);

    expect(api.calendarOptions()).toEqual([
      { value: null, label: 'companyLocationDialog.defaultCalendar' },
      { value: 1, label: 'Plant (America/Denver)' },
      { value: 2, label: 'Weekend crew (America/Denver)' },
    ]);
  });

  it('sends the chosen working calendar', () => {
    const { api, emitted } = create(location);
    api.form.patchValue({ workingCalendarId: 1 });

    api.save();

    expect(emitted[0].workingCalendarId).toBe(1);
  });

  it('sends no calendar for a new location left on the company default', () => {
    const { api, emitted } = create(null);
    api.form.patchValue({
      name: 'South plant',
      address: { line1: '2 Main St', city: 'Ogden', state: 'UT', postalCode: '84401', country: 'US' },
    });

    api.save();

    expect(api.isEdit()).toBe(false);
    expect(emitted[0].workingCalendarId).toBeNull();
  });
});
