import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { ApprovalWorkflowEditorComponent } from './approval-workflow-editor.component';
import { ApprovalsService } from '../../services/approvals.service';
import { ApprovalWorkflow } from '../../models/approval.model';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SelectOption } from '../../../../shared/components/select/select.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface EditorInternals {
  ngOnInit(): void;
  roleOptions(): SelectOption[];
  openEdit(workflow: ApprovalWorkflow): void;
}

function setup(roles: string[]): EditorInternals {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: ApprovalsService, useValue: { getWorkflows: () => of([]) } },
      { provide: ReferenceDataService, useValue: { getRoles: () => of(roles.map(name => ({ name }))) } },
      { provide: SnackbarService, useValue: { success: () => undefined } },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', { approvals: { roles: { manager: 'Plant Manager' } } });
  translate.use('en');

  const component = TestBed.runInInjectionContext(() => new ApprovalWorkflowEditorComponent());
  const internals = component as unknown as EditorInternals;
  internals.ngOnInit();
  return internals;
}

describe('ApprovalWorkflowEditorComponent role options', () => {
  it('offers every role the shop has, including Controller', () => {
    const editor = setup(['Admin', 'Controller', 'Manager', 'Procurement']);

    expect(editor.roleOptions().map(o => o.value)).toEqual(['Admin', 'Controller', 'Manager', 'Procurement']);
  });

  it('keeps the translated label for a known role and the role name for the rest', () => {
    const editor = setup(['Controller', 'Manager']);

    expect(editor.roleOptions()).toEqual([
      { value: 'Controller', label: 'Controller' },
      { value: 'Manager', label: 'Plant Manager' },
    ]);
  });

  it('keeps a saved step role selectable when it is no longer in the role list', () => {
    const editor = setup(['Manager']);

    editor.openEdit({
      id: 4, name: 'PO over 5k', entityType: 'PurchaseOrder', description: null, isActive: true,
      activationConditionsJson: null, createdAt: '2026-10-01T00:00:00Z',
      steps: [
        { id: 1, stepNumber: 1, name: 'Plant manager', approverType: 'Role', approverUserId: null, approverUserName: null, approverRole: 'Manager',
          useDirectManager: false, autoApproveBelow: null, escalationHours: null, requireComments: false, allowDelegation: true },
        { id: 2, stepNumber: 2, name: 'Finance', approverType: 'Role', approverUserId: null, approverUserName: null, approverRole: 'RetiredRole',
          useDirectManager: false, autoApproveBelow: null, escalationHours: null, requireComments: false, allowDelegation: false },
      ],
    });

    expect(editor.roleOptions().map(o => o.value)).toEqual(['Manager', 'RetiredRole']);
  });
});
