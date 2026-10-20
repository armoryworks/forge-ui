import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { OnboardingWizardComponent } from './onboarding-wizard.component';
import { OnboardingDraftStatus, OnboardingService, SaveOnboardingDraftRequest } from './onboarding.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LayoutService } from '../../shared/services/layout.service';
import { AuthService } from '../../shared/services/auth.service';

interface WizardApi {
  personalForm: FormGroup;
  i9Form: FormGroup;
  saveStepToDraft(stepIndex: number): void;
}

function calendarDay(value: unknown): [number, number, number] {
  const d = value as Date;
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}

describe('OnboardingWizardComponent date-only draft values west of UTC', () => {
  let originalTz: string | undefined;
  let saveDraft: ReturnType<typeof vi.fn>;

  const status = {
    firstName: 'Pat',
    lastName: 'Lee',
    dateOfBirth: '1990-05-15T00:00:00Z',
    i9WorkAuthExpiry: '2027-03-01T00:00:00Z',
    i9ListAExpiry: '2030-01-31T00:00:00Z',
    i9ListBExpiry: null,
    i9ListCExpiry: '2028-12-01T00:00:00Z',
  } as unknown as OnboardingDraftStatus;

  function create(): WizardApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingService,
          useValue: { getPolicyDocs: () => of({}), getDraft: () => of(status), saveDraft },
        },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: LayoutService, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({})), snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        { provide: AuthService, useValue: { user: () => null } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(OnboardingWizardComponent, { set: { template: '', imports: [] } });
    return TestBed.createComponent(OnboardingWizardComponent).componentInstance as unknown as WizardApi;
  }

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
    saveDraft = vi.fn((_payload: SaveOnboardingDraftRequest) => of(status));
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  it('loads the stored date of birth and I-9 expiries on their own calendar day', () => {
    const api = create();

    expect(calendarDay(api.personalForm.controls['dateOfBirth'].value)).toEqual([1990, 4, 15]);
    expect(calendarDay(api.i9Form.controls['workAuthExpiry'].value)).toEqual([2027, 2, 1]);
    expect(calendarDay(api.i9Form.controls['listAExpiry'].value)).toEqual([2030, 0, 31]);
    expect(api.i9Form.controls['listBExpiry'].value).toBeNull();
    expect(calendarDay(api.i9Form.controls['listCExpiry'].value)).toEqual([2028, 11, 1]);
  });

  it('saves an untouched personal step with the same date of birth', () => {
    const api = create();

    api.saveStepToDraft(0);

    expect(saveDraft).toHaveBeenCalled();
    const payload = saveDraft.mock.calls[0][0] as SaveOnboardingDraftRequest;
    expect(payload.dateOfBirth).toBe('1990-05-15T00:00:00Z');
  });
});

describe('OnboardingWizardComponent step gating', () => {
  interface StepApi {
    currentStepIndex(): number;
    w4Form: FormGroup;
    stateForm: FormGroup;
    addressForm: FormGroup;
  }

  function create(step: string, draft: Partial<OnboardingDraftStatus> = {}) {
    const navigate = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingService,
          useValue: { getPolicyDocs: () => of({}), getDraft: () => of(draft as OnboardingDraftStatus), saveDraft: vi.fn(() => of(draft)) },
        },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: Router, useValue: { navigate } },
        { provide: LayoutService, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ step })), snapshot: { queryParamMap: convertToParamMap({ step }) } },
        },
        { provide: AuthService, useValue: { user: () => null } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(OnboardingWizardComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(OnboardingWizardComponent);
    return { api: fixture.componentInstance as unknown as StepApi, fixture, navigate };
  }

  it('lands a fresh draft opened with ?step=6 on the first step and fixes the URL', () => {
    vi.useFakeTimers();
    const { api, fixture, navigate } = create('6');
    fixture.detectChanges();
    vi.runAllTimers();
    vi.useRealTimers();

    expect(api.currentStepIndex()).toBe(0);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { step: 0 }, replaceUrl: true }));
  });

  it('rejects negative, fractional and absurd W-4 and state figures', () => {
    const { api } = create('0');
    const w4 = api.w4Form.controls;
    w4['qualifyingChildren'].setValue(1.5);
    expect(w4['qualifyingChildren'].hasError('wholeNumber')).toBe(true);
    w4['otherDependents'].setValue(-1);
    expect(w4['otherDependents'].hasError('min')).toBe(true);
    w4['extraWithholding'].setValue(5_000_000);
    expect(w4['extraWithholding'].hasError('max')).toBe(true);

    const state = api.stateForm.controls;
    state['stateAllowances'].setValue(-2);
    expect(state['stateAllowances'].hasError('min')).toBe(true);
    state['stateAdditionalWithholding'].setValue(-10);
    expect(state['stateAdditionalWithholding'].hasError('min')).toBe(true);
  });

  it('does not require a state filing status where the state has no income tax', () => {
    const { api, fixture } = create('0');
    api.addressForm.controls['state'].setValue('TX');
    fixture.detectChanges();
    TestBed.tick();

    expect(api.stateForm.controls['stateFilingStatus'].hasError('required')).toBe(false);
    expect(api.stateForm.valid).toBe(true);
  });
});
