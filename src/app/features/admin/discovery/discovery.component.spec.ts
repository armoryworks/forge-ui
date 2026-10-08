import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, Directive, computed, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';

import { CapabilityService } from '../../../shared/services/capability.service';
import { CapabilityInstallStateService } from '../../../shared/services/capability-install-state.service';
import { ConsultantModeService } from '../../../shared/services/consultant-mode.service';
import { DiscoveryService } from '../../../shared/services/discovery.service';
import { PresetService } from '../../../shared/services/preset.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AdminSettingsService } from '../settings/services/admin-settings.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DiscoveryQuestion } from '../../../shared/models/discovery-question.model';
import { DiscoveryRecommendation } from '../../../shared/models/discovery-recommendation.model';
import { DiscoveryComponent } from './discovery.component';

@Component({
  selector: 'app-page-layout',
  standalone: true,
  template: '<ng-content select="[content]" />',
})
class StubPageLayoutComponent {
  readonly pageTitle = input('');
  readonly pageSubtitle = input('');
}

@Directive({ selector: '[appLoadingBlock]', standalone: true })
class StubLoadingBlockDirective {
  readonly appLoadingBlock = input<boolean>(false);
}

const QUESTION: DiscoveryQuestion = {
  id: 'Q-C3',
  stage: 'BranchC',
  category: 'BranchSpecific',
  type: 'SingleChoice',
  text: 'Do any of your major customers send orders through EDI?',
  whyAsking: 'Large customers often require electronic documents.',
  choices: [{ value: 'yes', label: 'Yes', exclusive: false }, { value: 'no', label: 'No', exclusive: false }],
  branch: 'C',
  internalNote: 'EDI is on by default in PRESET-06 and PRESET-07.',
};

const RECOMMENDATION: DiscoveryRecommendation = {
  presetId: 'PRESET-06',
  presetName: 'Multi-Site Operation',
  presetDescription: 'Several sites moving stock between them.',
  confidence: 0.9,
  confidenceLabel: 'high',
  rationale: 'Based on your answers we recommend Multi-Site Operation.',
  factors: [{ questionId: 'Q-O5', description: 'You work from two locations' }],
  alternatives: [],
  capabilityDeltas: [
    { code: 'CAP-INV-MULTILOC', name: 'Multi-location inventory', currentlyEnabled: false, willBeEnabled: true },
    { code: 'CAP-IDEN-AUTH-KIOSK', name: 'Kiosk sign-in', currentlyEnabled: false, willBeEnabled: true },
  ],
  capabilityAdjustments: [
    { code: 'CAP-IDEN-AUTH-KIOSK', name: 'Kiosk sign-in', enabled: false, reason: 'Nobody shares a terminal.' },
  ],
};

const CERTIFICATIONS: DiscoveryQuestion = {
  id: 'Q-O4',
  stage: 'Opening',
  category: 'Opening',
  type: 'MultiChoice',
  text: 'Are you in a regulated industry?',
  whyAsking: 'Certifications change the setup.',
  choices: [
    { value: 'no', label: 'No, none of these apply', exclusive: true },
    { value: 'medical', label: 'Medical devices', exclusive: false },
    { value: 'aerospace', label: 'Aerospace', exclusive: false },
  ],
  branch: null,
};

const OWN_NUMBERS: DiscoveryQuestion = {
  id: 'Q-D8',
  stage: 'Diagnostic',
  category: 'Diagnostic',
  type: 'MultiChoice',
  text: 'Do you already use your own numbers for any of these?',
  whyAsking: 'Keep the numbers people know.',
  choices: [
    { value: 'parts', label: 'Parts', exclusive: false },
    { value: 'jobs', label: 'Work orders', exclusive: false },
  ],
  branch: null,
};

const INTERNAL_CODE = /\b(Q-[A-Z]\d|PRESET-|CAP-)/;

describe('DiscoveryComponent', () => {
  let fixture: ComponentFixture<DiscoveryComponent>;
  let consultantMode: ReturnType<typeof signal<boolean>>;
  let step$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  let successWithNav: ReturnType<typeof vi.fn>;
  let afterClosed: ReturnType<typeof vi.fn>;
  let questions: ReturnType<typeof signal<DiscoveryQuestion[]>>;
  let answers: ReturnType<typeof signal<Map<string, string>>>;
  let capabilityEnabled: Set<string>;
  let bulkToggle: ReturnType<typeof vi.fn>;
  let updateSetting: ReturnType<typeof vi.fn>;

  function render(step: number): void {
    step$.next(convertToParamMap({ step: String(step) }));
    fixture = TestBed.createComponent(DiscoveryComponent);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    consultantMode = signal(false);
    step$ = new BehaviorSubject(convertToParamMap({ step: '0' }));
    navigate = vi.fn().mockResolvedValue(true);
    successWithNav = vi.fn();
    afterClosed = vi.fn(() => of({ confirmed: true }));
    questions = signal<DiscoveryQuestion[]>([QUESTION]);
    answers = signal(new Map<string, string>());
    capabilityEnabled = new Set<string>();
    bulkToggle = vi.fn(() => of([]));
    updateSetting = vi.fn(() => of(undefined));

    const discovery = {
      questions,
      visibleQuestions: computed(() => questions()),
      answers,
      recommendation: signal<DiscoveryRecommendation | null>(RECOMMENDATION),
      loading: signal(false),
      previewing: signal(false),
      applying: signal(false),
      canPreview: signal(false),
      branch: signal('C'),
      loadQuestions: () => of({ totalCount: 1, selfServeCount: 1, consultantDeepdiveCount: 0, questions: [QUESTION] }),
      setConsultantMode: () => undefined,
      setAnswer: (id: string, value: string) => answers.update((m) => new Map(m).set(id, value)),
      preview: () => of(RECOMMENDATION),
      apply: () => of(RECOMMENDATION),
    };

    TestBed.configureTestingModule({
      imports: [DiscoveryComponent, TranslateModule.forRoot()],
      providers: [
        { provide: DiscoveryService, useValue: discovery },
        { provide: ConsultantModeService, useValue: { enabled: consultantMode, toggle: () => consultantMode.update(v => !v) } },
        {
          provide: CapabilityService,
          useValue: { load: () => of(undefined), isEnabled: (code: string) => capabilityEnabled.has(code), bulkToggle },
        },
        { provide: AdminSettingsService, useValue: { updateSetting } },
        { provide: CapabilityInstallStateService, useValue: { dismiss: () => undefined } },
        { provide: PresetService, useValue: { previewApply: () => of({ isCustom: false, deltas: [], violations: [], deltaCount: 1 }) } },
        { provide: SnackbarService, useValue: { successWithNav, error: () => undefined } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed }) } },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { queryParamMap: step$ } },
      ],
    });
    TestBed.overrideComponent(DiscoveryComponent, {
      remove: { imports: [PageLayoutComponent, LoadingBlockDirective] },
      add: { imports: [StubPageLayoutComponent, StubLoadingBlockDirective] },
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      discoveryWizard: { applied: 'Discovery applied — {{preset}}.', reviewCapabilities: 'Review capabilities' },
    });
    translate.use('en');
  });

  function checkbox(value: string): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLInputElement>(`[data-choice-value="${value}"] input[type="checkbox"]`)!;
  }

  function click(value: string): void {
    checkbox(value).click();
    fixture.detectChanges();
  }

  it('shows a self-serve question without its id or internal note', () => {
    render(0);

    expect(text()).toContain(QUESTION.whyAsking);
    expect(text()).not.toMatch(INTERNAL_CODE);
    expect(text()).not.toContain('Branch C');
  });

  it('shows the question id, internal note and branch in consultant mode', () => {
    consultantMode.set(true);
    render(0);

    expect(text()).toContain('Q-C3');
    expect(text()).toContain(QUESTION.internalNote!);
    expect(text()).toContain('Branch C');
  });

  it('shows a self-serve recommendation without question or capability codes', () => {
    render(1);

    expect(text()).toContain('Multi-location inventory');
    expect(text()).toContain('You work from two locations');
    expect(text()).not.toMatch(INTERNAL_CODE);
  });

  it('shows question and capability codes on the recommendation in consultant mode', () => {
    consultantMode.set(true);
    render(1);

    expect(text()).toContain('Q-O5');
    expect(text()).toContain('CAP-INV-MULTILOC');
  });

  it('lands on the dashboard after applying, offering a way to review capabilities', async () => {
    render(1);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="discovery-apply-btn"]')!.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(successWithNav).toHaveBeenCalledWith(
      expect.stringContaining('Multi-Site Operation'), '/admin/capabilities', 'Review capabilities');
  });

  it('clears the other boxes when an exclusive answer is checked, and the exclusive one when another is', () => {
    questions.set([CERTIFICATIONS]);
    render(0);

    click('medical');
    click('aerospace');
    expect(answers().get('Q-O4')).toBe('medical,aerospace');

    click('no');
    expect(answers().get('Q-O4')).toBe('no');
    expect(checkbox('medical').checked).toBe(false);
    expect(checkbox('aerospace').checked).toBe(false);

    click('medical');
    expect(answers().get('Q-O4')).toBe('medical');
    expect(checkbox('no').checked).toBe(false);

    click('medical');
    expect(answers().get('Q-O4')).toBe('');
  });

  it('shows the adjustments from the answers and drops the preset changes they override', () => {
    render(1);

    const adjustments = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="discovery-adjustments"]');
    expect(adjustments?.textContent).toContain('Kiosk sign-in');
    expect(adjustments?.textContent).toContain('Nobody shares a terminal.');
    const deltas = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="discovery-deltas"]');
    expect(deltas?.textContent).toContain('Multi-location inventory');
    expect(deltas?.textContent).not.toContain('Kiosk sign-in');
  });

  it('applies the adjustments and turns on the chosen manual numbers after the preset', async () => {
    questions.set([QUESTION, OWN_NUMBERS]);
    answers.set(new Map([['Q-D8', 'parts,jobs']]));
    capabilityEnabled.add('CAP-IDEN-AUTH-KIOSK');
    render(2);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="discovery-apply-btn"]')!.click();
    await fixture.whenStable();

    expect(bulkToggle).toHaveBeenCalledWith([{ id: 'CAP-IDEN-AUTH-KIOSK', enabled: false }], 'Nobody shares a terminal.');
    expect(updateSetting).toHaveBeenCalledWith('parts.allow_manual_numbers', 'true');
    expect(updateSetting).toHaveBeenCalledWith('jobs.allow_manual_numbers', 'true');
    expect(successWithNav).toHaveBeenCalled();
  });

  it('skips adjustments the install already matches', async () => {
    render(1);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="discovery-apply-btn"]')!.click();
    await fixture.whenStable();

    expect(bulkToggle).not.toHaveBeenCalled();
    expect(updateSetting).not.toHaveBeenCalled();
  });
});
