import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TrainingPathDialogComponent } from './training-path-dialog.component';
import { TrainingPathDialogData } from './training-path-dialog-data.model';

interface PathDialogView {
  ngOnInit(): void;
  selectedModules(): { id: number; title: string }[];
  addOptions(): { value: unknown }[];
  addModuleControl: { setValue(v: number | null): void };
  moveModule(index: number, delta: number): void;
  removeModule(index: number): void;
  save(): void;
  dialogRef: { clearDraft(): void };
}

const catalog = [{ id: 1, title: 'Lockout' }, { id: 2, title: 'Forklift' }, { id: 3, title: 'First aid' }];

function setup(data: TrainingPathDialogData) {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new TrainingPathDialogComponent()) as unknown as PathDialogView;
  view.dialogRef = { clearDraft: vi.fn() };
  view.ngOnInit();
  return { view, close, http: TestBed.inject(HttpTestingController) };
}

describe('TrainingPathDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('adds, reorders and removes modules and saves them in order', () => {
    const { view, http, close } = setup({
      path: { id: 7, title: 'Floor safety', slug: 'floor-safety', icon: 'school', isAutoAssigned: false, isActive: true, moduleIds: [1, 2] },
      availableModules: catalog,
    });
    expect(view.selectedModules().map(m => m.title)).toEqual(['Lockout', 'Forklift']);
    expect(view.addOptions().map(o => o.value)).toEqual([3]);

    view.addModuleControl.setValue(3);
    view.moveModule(2, -1);
    view.removeModule(0);
    expect(view.selectedModules().map(m => m.id)).toEqual([3, 2]);

    view.save();

    const req = http.expectOne('/api/v1/training/paths/7');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.moduleIds).toEqual([3, 2]);
    req.flush({});
    expect(close).toHaveBeenCalledWith(true);
  });

  it('creates a path with no modules when none are picked', () => {
    const { view, http } = setup({ path: null, availableModules: catalog });
    (view as unknown as { form: { patchValue(v: unknown): void } }).form.patchValue({ title: 'New hires' });
    view.save();
    const req = http.expectOne('/api/v1/training/paths');
    expect(req.request.body).toEqual(expect.objectContaining({ title: 'New hires', slug: 'new-hires', moduleIds: [] }));
  });
});
