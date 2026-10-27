import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PpapDetailComponent } from './ppap-detail.component';
import { PpapService } from '../../services/ppap.service';
import { PpapSubmission } from '../../models/ppap-submission.model';
import { PpapElement } from '../../models/ppap-element.model';
import { AuthService } from '../../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface DetailApi {
  submission(): PpapSubmission | null;
  editable(): boolean;
  canSubmit(): boolean;
  canRespond(): boolean;
  canSign(): boolean;
  incompleteRequired(): PpapElement[];
  statusControls: Map<number, { setValue(v: string): void }>;
  changeElementStatus(e: PpapElement): void;
  submit(): void;
  signPsw(): void;
}

function submission(status: string, elements: Partial<PpapElement>[], signed = false): PpapSubmission {
  return {
    id: 3, submissionNumber: 'PPAP-0003', partNumber: 'P-1', customerName: 'Auto Co', status, pswSignedAt: signed ? '2026-10-01' : null,
    elements: elements.map((e, i) => ({ id: i + 1, elementNumber: i + 1, elementName: `E${i + 1}`, isRequired: true, status: 'NotStarted', notes: null, attachmentCount: 0, ...e })),
  } as unknown as PpapSubmission;
}

describe('PpapDetailComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let roles: string[];
  let current: PpapSubmission;
  let dialogOpen: ReturnType<typeof vi.fn>;

  function setup(): DetailApi {
    service = {
      get: vi.fn(() => of(current)),
      updateElement: vi.fn(() => of({})),
      submit: vi.fn(() => of(undefined)),
      signPsw: vi.fn(() => of(undefined)),
    };
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(true) }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PpapService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '3' }) } } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new PpapDetailComponent()) as unknown as DetailApi;
  }

  beforeEach(() => { roles = ['Engineer']; });

  it('holds submit back until every required element is complete or not applicable', () => {
    current = submission('InProgress', [{ status: 'Complete' }, { status: 'InProgress' }, { status: 'NotStarted', isRequired: false }]);
    const detail = setup();

    expect(detail.editable()).toBe(true);
    expect(detail.incompleteRequired().map(e => e.elementNumber)).toEqual([2]);
    expect(detail.canSubmit()).toBe(false);
    detail.submit();
    expect(service['submit']).not.toHaveBeenCalled();
  });

  it('saves an element status change and submits once the checklist is done', () => {
    current = submission('InProgress', [{ status: 'Complete' }, { status: 'NotApplicable' }]);
    const detail = setup();
    detail.statusControls.get(1)!.setValue('InProgress');

    detail.changeElementStatus(current.elements[0]);
    expect(service['updateElement']).toHaveBeenCalledWith(3, 1, { status: 'InProgress' });

    detail.submit();
    expect(service['submit']).toHaveBeenCalledWith(3);
  });

  it('lets only a manager record the customer response, and only once submitted', () => {
    current = submission('Submitted', [{ status: 'Complete' }]);
    expect(setup().canRespond()).toBe(false);

    roles = ['Manager'];
    const detail = setup();
    expect(detail.canRespond()).toBe(true);
    expect(detail.editable()).toBe(false);
  });

  it('signs the PSW after confirmation and hides it once signed', () => {
    current = submission('Approved', [{ status: 'Complete' }]);
    const detail = setup();

    detail.signPsw();
    expect(service['signPsw']).toHaveBeenCalledWith(3);

    current = submission('Approved', [{ status: 'Complete' }], true);
    expect(setup().canSign()).toBe(false);
  });
});
