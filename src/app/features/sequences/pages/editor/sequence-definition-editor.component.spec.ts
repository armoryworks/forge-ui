import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SelectOption } from '../../../../shared/components/select/select.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SequencesService } from '../../services/sequences.service';
import { SequenceDefinitionEditorComponent } from './sequence-definition-editor.component';

interface EditorApi {
  form: FormGroup;
  steps: FormArray<FormGroup>;
  subjectTypeOptions(): SelectOption[];
}

function setup(subjectEntityType: string | null): EditorApi {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
      {
        provide: SequencesService, useValue: {
          getDefinition: () => of({
            id: 5, code: 'fai', name: 'FAI', description: null, subjectEntityType, autoStartOnSubjectCreate: false,
            steps: [{ key: 'a', name: 'A', description: null, sortOrder: 1, joinPolicy: 'All', maxDwellMinutes: null, dwellExpiryAction: 'Flag', escalateRole: null }],
            edges: [], gates: [],
          }),
        },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => new SequenceDefinitionEditorComponent()) as unknown as EditorApi;
}

describe('SequenceDefinitionEditorComponent · subject type', () => {
  it('offers None and Job and shows a lower-case job as Job', () => {
    const editor = setup('job');

    expect(editor.subjectTypeOptions().map(o => o.value)).toEqual(['', 'Job']);
    expect(editor.form.value.subjectEntityType).toBe('Job');
  });

  it('keeps a subject type it does not know as an option', () => {
    const editor = setup('Lot');

    expect(editor.subjectTypeOptions().map(o => o.value)).toEqual(['', 'Job', 'Lot']);
    expect(editor.form.value.subjectEntityType).toBe('Lot');
  });

  it('refuses a max dwell below one minute', () => {
    const step = setup(null).steps.at(0);

    step.controls['maxDwellMinutes'].setValue(0);
    expect(step.controls['maxDwellMinutes'].invalid).toBe(true);

    step.controls['maxDwellMinutes'].setValue(null);
    expect(step.controls['maxDwellMinutes'].valid).toBe(true);
  });
});
