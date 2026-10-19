import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SequencesService } from '../../services/sequences.service';
import { SequenceInstancesPageComponent } from './sequence-instances-page.component';

interface StartApi {
  startDefId: FormControl<number | null>;
  startSubjectId: FormControl<number | null>;
  subjectType(): string | null;
  isJobSubject(): boolean;
  canStart(): boolean;
  start(): void;
}

function setup(): { page: StartApi; start: ReturnType<typeof vi.fn> } {
  const start = vi.fn(() => of({ id: 99 }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      {
        provide: SequencesService, useValue: {
          getInstances: () => of([]),
          getDefinitions: () => of([
            { id: 1, name: 'First article', version: 1, subjectEntityType: 'Job' },
            { id: 2, name: 'Free run', version: 1, subjectEntityType: null },
          ]),
          start,
        },
      },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new SequenceInstancesPageComponent()) as unknown as StartApi;
  return { page, start };
}

describe('SequenceInstancesPageComponent · start', () => {
  it('takes the subject type from the chosen definition and asks for a job', () => {
    const { page } = setup();

    page.startDefId.setValue(1);

    expect(page.subjectType()).toBe('Job');
    expect(page.isJobSubject()).toBe(true);
    expect(page.canStart()).toBe(false);
  });

  it('starts against the chosen job with the definition subject type', () => {
    const { page, start } = setup();
    page.startDefId.setValue(1);
    page.startSubjectId.setValue(42);

    page.start();

    expect(start).toHaveBeenCalledWith({ definitionId: 1, subjectEntityType: 'Job', subjectEntityId: 42 });
  });

  it('starts a definition without a subject type with no subject', () => {
    const { page, start } = setup();
    page.startDefId.setValue(2);

    expect(page.subjectType()).toBeNull();
    expect(page.canStart()).toBe(true);
    page.start();

    expect(start).toHaveBeenCalledWith({ definitionId: 2, subjectEntityType: null, subjectEntityId: null });
  });
});
