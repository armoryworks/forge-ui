import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, Directive, computed, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of } from 'rxjs';

import { CapabilityService } from '../../../shared/services/capability.service';
import { CapabilityInstallStateService } from '../../../shared/services/capability-install-state.service';
import { ConsultantModeService } from '../../../shared/services/consultant-mode.service';
import { DiscoveryService } from '../../../shared/services/discovery.service';
import { PresetService } from '../../../shared/services/preset.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
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
  choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
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
  factors: [{ questionId: 'Q-O5', description: 'Sites: dual' }],
  alternatives: [],
  capabilityDeltas: [{ code: 'CAP-INV-MULTILOC', name: 'Multi-location inventory', currentlyEnabled: false, willBeEnabled: true }],
};

const INTERNAL_CODE = /\b(Q-[A-Z]\d|PRESET-|CAP-)/;

describe('DiscoveryComponent', () => {
  let fixture: ComponentFixture<DiscoveryComponent>;
  let consultantMode: ReturnType<typeof signal<boolean>>;
  let step$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  let successWithNav: ReturnType<typeof vi.fn>;
  let afterClosed: ReturnType<typeof vi.fn>;

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

    const questions = signal<DiscoveryQuestion[]>([QUESTION]);
    const discovery = {
      visibleQuestions: computed(() => questions()),
      answers: signal(new Map<string, string>()),
      recommendation: signal<DiscoveryRecommendation | null>(RECOMMENDATION),
      loading: signal(false),
      previewing: signal(false),
      applying: signal(false),
      canPreview: signal(false),
      branch: signal('C'),
      loadQuestions: () => of({ totalCount: 1, selfServeCount: 1, consultantDeepdiveCount: 0, questions: [QUESTION] }),
      setConsultantMode: () => undefined,
      setAnswer: () => undefined,
      preview: () => of(RECOMMENDATION),
      apply: () => of(RECOMMENDATION),
    };

    TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        { provide: DiscoveryService, useValue: discovery },
        { provide: ConsultantModeService, useValue: { enabled: consultantMode, toggle: () => consultantMode.update(v => !v) } },
        { provide: CapabilityService, useValue: { load: () => of(null) } },
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
  });

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
    expect(text()).toContain('Sites: dual');
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
});
