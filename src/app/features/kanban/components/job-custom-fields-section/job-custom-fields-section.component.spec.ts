import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';

import { of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { KanbanService } from '../../services/kanban.service';
import { JobCustomFieldsSectionComponent } from './job-custom-fields-section.component';

interface SectionInternals {
  definitions(): { key: string }[];
  form(): FormGroup;
  load(jobId: number, trackTypeId: number): void;
  save(): void;
}

describe('JobCustomFieldsSectionComponent', () => {
  const kanban = { getCustomFieldDefinitions: vi.fn(), getCustomFieldValues: vi.fn(), updateCustomFieldValues: vi.fn() };

  function build(): SectionInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: KanbanService, useValue: kanban },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    const section = TestBed.runInInjectionContext(() => new JobCustomFieldsSectionComponent()) as unknown as SectionInternals;
    Object.defineProperty(section, 'jobId', { value: () => 3 });
    return section;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    kanban.getCustomFieldDefinitions.mockReturnValue(of([
      { key: 'po_ref', label: 'PO ref', type: 'text', isRequired: true, options: null },
      { key: 'qty', label: 'Qty', type: 'number', isRequired: false, options: null },
      { key: 'due', label: 'Due', type: 'date', isRequired: false, options: null },
      { key: 'rush', label: 'Rush', type: 'toggle', isRequired: false, options: null },
    ]));
    kanban.getCustomFieldValues.mockReturnValue(of({ po_ref: 'A-1', due: '2026-11-02' }));
    kanban.updateCustomFieldValues.mockReturnValue(of({}));
  });

  it('renders nothing when the track type defines no fields', () => {
    kanban.getCustomFieldDefinitions.mockReturnValue(of([]));
    const section = build();

    section.load(3, 4);

    expect(section.definitions()).toEqual([]);
  });

  it('loads the track type definitions and the job values', () => {
    const section = build();

    section.load(3, 4);

    expect(kanban.getCustomFieldDefinitions).toHaveBeenCalledWith(4);
    expect(section.form().controls['po_ref'].value).toBe('A-1');
    expect(section.form().controls['due'].value).toBeInstanceOf(Date);
    expect(section.form().controls['rush'].value).toBe(false);
  });

  it('blocks a save with a required field empty and saves typed values', () => {
    const section = build();
    section.load(3, 4);

    section.form().controls['po_ref'].setValue('');
    section.save();
    expect(kanban.updateCustomFieldValues).not.toHaveBeenCalled();

    section.form().controls['po_ref'].setValue('B-2');
    section.form().controls['qty'].setValue('12');
    section.form().controls['rush'].setValue(true);
    section.save();
    expect(kanban.updateCustomFieldValues).toHaveBeenCalledWith(3, { po_ref: 'B-2', qty: 12, due: '2026-11-02', rush: true });
  });
});
