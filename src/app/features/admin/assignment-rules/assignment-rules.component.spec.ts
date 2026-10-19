import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AssignmentRulesComponent } from './assignment-rules.component';
import { AssignmentRuleService } from '../services/assignment-rule.service';
import { AdminService } from '../services/admin.service';
import { AssignmentRule } from '../models/assignment-rule.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { SelectOption } from '../../../shared/components/select/select.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface RulesInternals {
  openEdit(row: AssignmentRule): void;
  save(): void;
  repOptions: { (): SelectOption[] };
  form: { controls: { specRepIds: { value: number[]; setValue(v: number[]): void } } };
}

describe('AssignmentRulesComponent rep picker', () => {
  let update: ReturnType<typeof vi.fn>;
  let component: RulesInternals;

  beforeEach(() => {
    TestBed.resetTestingModule();
    update = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: AssignmentRuleService, useValue: { list: () => of([]), update, create: vi.fn(() => of({})) } },
        { provide: AdminService, useValue: { getActiveUsers: () => of([{ id: 12, name: 'Pat Rep', initials: 'PR', color: '' }]) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AssignmentRulesComponent()) as unknown as RulesInternals;
  });

  const rule: AssignmentRule = {
    id: 5, name: 'Rotation', kind: 'RoundRobin', priority: 100, isActive: true,
    spec: '{"repIds":[12,99]}', createdAt: '2026-10-01T00:00:00Z',
  };

  it('offers active users by name and keeps a saved rep who is no longer active', () => {
    component.openEdit(rule);

    expect(component.form.controls.specRepIds.value).toEqual([12, 99]);
    expect(component.repOptions().map(o => o.value)).toEqual([12, 99]);
    expect(component.repOptions()[0].label).toBe('Pat Rep');
  });

  it('still saves the picked reps as the int[] repIds spec', () => {
    component.openEdit(rule);
    component.form.controls.specRepIds.setValue([12]);

    component.save();

    expect(update).toHaveBeenCalledWith(5, expect.objectContaining({ spec: '{"repIds":[12]}' }));
  });
});
