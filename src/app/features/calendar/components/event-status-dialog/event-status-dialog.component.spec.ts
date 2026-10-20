import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CalendarService } from '../../services/calendar.service';
import { EventStatusDialogComponent } from './event-status-dialog.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface StatusDialogInternals {
  form: EventStatusDialogComponent['form'];
  canSave(): boolean;
}

function setup(currentStatus: string | null): StatusDialogInternals {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MAT_DIALOG_DATA, useValue: { eventId: 1, title: 'Filing', currentStatus } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: CalendarService, useValue: { updateEventStatus: vi.fn(() => of(undefined)) } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  return TestBed.runInInjectionContext(() => new EventStatusDialogComponent()) as unknown as StatusDialogInternals;
}

describe('EventStatusDialogComponent', () => {
  it('preselects Open when the event comes back with an empty status', () => {
    const dialog = setup('');

    expect(dialog.form.controls.status.value).toBe('Open');
    expect(dialog.canSave()).toBe(true);
  });

  it('keeps the current status when there is one', () => {
    expect(setup('Done').form.controls.status.value).toBe('Done');
  });
});
