import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CapaDetailDialogComponent } from './capa-detail-dialog.component';
import { NcrCapaService } from '../../services/ncr-capa.service';
import { CorrectiveAction } from '../../models/corrective-action.model';
import { CapaTask } from '../../models/capa-task.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface DetailView {
  form: FormGroup;
  capa: Signal<CorrectiveAction | null>;
  canManage: Signal<boolean>;
  ngOnInit(): void;
  save(): void;
  advance(): void;
  setTaskStatus(task: CapaTask, status: unknown): void;
}

const CAPA = {
  id: 3, capaNumber: 'CAPA-00003', title: 'Burrs', status: 'RootCauseAnalysis', ownerId: 7,
  rootCauseAnalysis: null, rootCauseMethod: null, advanceBlockers: ['root cause analysis', 'root cause method'],
} as unknown as CorrectiveAction;

function create(roles: string[]) {
  TestBed.resetTestingModule();
  const service = {
    getCapa: vi.fn(() => of(CAPA)),
    getCapaTasks: vi.fn(() => of([] as CapaTask[])),
    updateCapa: vi.fn(() => of(undefined)),
    advanceCapaPhase: vi.fn(() => of({ ...CAPA, status: 'ActionPlanning' })),
    updateCapaTask: vi.fn(() => of(undefined)),
    createCapaTask: vi.fn(() => of({})),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: NcrCapaService, useValue: service },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => {
    const component = new CapaDetailDialogComponent();
    Object.defineProperty(component, 'capaId', { value: () => 3 });
    return component;
  }) as unknown as DetailView;
  view.ngOnInit();
  return { view, service };
}

describe('CapaDetailDialogComponent', () => {
  it('saves the root cause before advancing so the phase can move on', () => {
    const { view, service } = create(['Manager']);
    view.form.patchValue({ rootCauseAnalysis: 'Worn deburr tool', rootCauseMethod: 'FiveWhy' });
    view.form.markAsDirty();

    view.advance();

    expect(service.updateCapa).toHaveBeenCalledWith(3, expect.objectContaining({
      rootCauseAnalysis: 'Worn deburr tool', rootCauseMethod: 'FiveWhy',
    }));
    expect(service.advanceCapaPhase).toHaveBeenCalledWith(3);
  });

  it('advances without a save when nothing was edited', () => {
    const { view, service } = create(['Admin']);

    view.advance();

    expect(service.updateCapa).not.toHaveBeenCalled();
    expect(service.advanceCapaPhase).toHaveBeenCalledWith(3);
  });

  it('is read-only for roles the API refuses, but still lets a task be completed', () => {
    const { view, service } = create(['ProductionWorker']);

    expect(view.canManage()).toBe(false);
    expect(view.form.disabled).toBe(true);
    view.setTaskStatus({ id: 4, status: 'Open' } as CapaTask, 'Completed');

    expect(service.updateCapaTask).toHaveBeenCalledWith(3, 4, { status: 'Completed' });
  });
});
