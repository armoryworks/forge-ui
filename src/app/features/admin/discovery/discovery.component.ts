import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { CapabilityService } from '../../../shared/services/capability.service';
import { CapabilityInstallStateService } from '../../../shared/services/capability-install-state.service';
import { ConsultantModeService } from '../../../shared/services/consultant-mode.service';
import { DiscoveryService } from '../../../shared/services/discovery.service';
import { PresetService } from '../../../shared/services/preset.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AdminSettingsService } from '../settings/services/admin-settings.service';

import {
  CapabilityDelta,
  DiscoveryAlternative,
  DiscoveryRecommendation,
} from '../../../shared/models/discovery-recommendation.model';
import { DiscoveryCapabilityAdjustment } from '../../../shared/models/discovery-capability-adjustment.model';
import { DiscoveryChoice, DiscoveryQuestion } from '../../../shared/models/discovery-question.model';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import {
  PresetApplyDialogComponent,
  PresetApplyDialogData,
  PresetApplyDialogResult,
} from '../../../shared/components/preset-apply-dialog/preset-apply-dialog.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

/**
 * Phase 4 Phase-F — Discovery wizard. Walks an admin through ~22 questions
 * (or more in consultant mode), branches by size / regulation / multi-site,
 * shows a live recommendation, and lets the admin preview and apply.
 *
 * Multi-step wizard pattern per CLAUDE.md "URL as Source of Truth": the
 * current step is a `?step=N` query param; back/forward browser navigation
 * moves through steps. Answers live in DiscoveryService (signal-based,
 * lost on page refresh).
 */
@Component({
  selector: 'app-discovery',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTooltipModule,
    MatRadioModule,
    MatCheckboxModule,
    TranslatePipe,
    PageLayoutComponent,
    TextareaComponent,
    ToggleComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './discovery.component.html',
  styleUrl: './discovery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoveryComponent implements OnInit {
  private readonly discovery = inject(DiscoveryService);
  private readonly capabilityService = inject(CapabilityService);
  private readonly consultantMode = inject(ConsultantModeService);
  private readonly installState = inject(CapabilityInstallStateService);
  private readonly presetService = inject(PresetService);
  private readonly snackbar = inject(SnackbarService);
  private readonly adminSettings = inject(AdminSettingsService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly visibleQuestions = this.discovery.visibleQuestions;
  protected readonly answers = this.discovery.answers;
  protected readonly recommendation = this.discovery.recommendation;
  protected readonly loading = this.discovery.loading;
  protected readonly previewing = this.discovery.previewing;
  protected readonly applying = this.discovery.applying;
  protected readonly canPreview = this.discovery.canPreview;
  protected readonly branch = this.discovery.branch;
  protected readonly consultantModeEnabled = this.consultantMode.enabled;

  protected readonly currentStep = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => {
        const n = parseInt(p.get('step') ?? '0', 10);
        return isNaN(n) || n < 0 ? 0 : n;
      }),
    ),
    { initialValue: 0 },
  );

  protected readonly currentQuestion = computed<DiscoveryQuestion | null>(() => {
    const list = this.visibleQuestions();
    const idx = this.currentStep();
    if (idx < 0 || idx >= list.length) return null;
    return list[idx];
  });

  protected readonly progressLabel = computed<string>(() => {
    const total = this.visibleQuestions().length;
    const step = Math.min(this.currentStep() + 1, total);
    return `${step} of ${total}`;
  });

  protected readonly progressPercent = computed<number>(() => {
    const total = this.visibleQuestions().length;
    if (total === 0) return 0;
    return Math.round(((this.currentStep() + 1) / total) * 100);
  });

  protected readonly isOnRecommendationStep = computed<boolean>(
    () => this.currentStep() >= this.visibleQuestions().length,
  );

  /** The user's choice of preset to actually apply (may differ from recommended). */
  protected readonly chosenPresetId = signal<string | null>(null);

  protected readonly chosenPreset = computed<{ id: string; name: string; rationale: string } | null>(() => {
    const rec = this.recommendation();
    if (!rec) return null;
    const chosen = this.chosenPresetId();
    if (!chosen || chosen === rec.presetId) {
      return { id: rec.presetId, name: rec.presetName, rationale: '' };
    }
    const alt = rec.alternatives.find((a) => a.presetId === chosen);
    if (alt) return { id: alt.presetId, name: alt.presetName, rationale: alt.distinguishingRationale };
    return { id: rec.presetId, name: rec.presetName, rationale: '' };
  });

  protected readonly previewDeltas = computed<CapabilityDelta[]>(() => {
    const rec = this.recommendation();
    if (!rec) return [];
    const adjusted = new Map(rec.capabilityAdjustments.map((a) => [a.code, a.enabled]));
    return rec.capabilityDeltas.filter((d) => (adjusted.get(d.code) ?? d.willBeEnabled) === d.willBeEnabled);
  });

  protected readonly textareaControls = new Map<string, FormControl<string | null>>();

  ngOnInit(): void {
    // Load both questions and capability descriptor (deltas need current state).
    this.capabilityService.load().subscribe();
    this.discovery
      .loadQuestions(this.consultantMode.enabled())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // After loading, restore any stored answers into free-text inputs.
        for (const q of this.visibleQuestions()) {
          if (q.type === 'FreeText' || q.type === 'YesNoWithDetail') {
            const existing = this.answers().get(q.id) ?? '';
            this.textareaControls.set(q.id, new FormControl(existing));
          }
        }
      });
  }

  protected toggleConsultantMode(): void {
    this.consultantMode.toggle();
    this.discovery.setConsultantMode(this.consultantMode.enabled());
  }

  protected setAnswer(questionId: string, value: string): void {
    this.discovery.setAnswer(questionId, value);
    this.previewIfReady();
  }

  protected setFreeTextAnswer(questionId: string, value: string): void {
    this.discovery.setAnswer(questionId, value ?? '');
    // Don't preview on every keystroke — preview when the user advances.
  }

  protected onTextareaInput(questionId: string, evt: Event): void {
    const target = evt.target as HTMLTextAreaElement | null;
    if (!target) return;
    this.setFreeTextAnswer(questionId, target.value ?? '');
  }

  protected isChecked(questionId: string, value: string): boolean {
    return this.selectedValues(questionId).includes(value);
  }

  protected toggleChoice(question: DiscoveryQuestion, choice: DiscoveryChoice, checked: boolean): void {
    const current = this.selectedValues(question.id).filter((v) => v !== choice.value);
    let next = current;
    if (checked && choice.exclusive) {
      next = [choice.value];
    } else if (checked) {
      const exclusive = new Set((question.choices ?? []).filter((c) => c.exclusive).map((c) => c.value));
      next = [...current.filter((v) => !exclusive.has(v)), choice.value];
    }
    this.setAnswer(question.id, next.join(','));
  }

  private selectedValues(questionId: string): string[] {
    return this.getAnswer(questionId).split(',').filter((v) => v !== '');
  }

  protected isAnswered(questionId: string): boolean {
    const v = this.answers().get(questionId);
    return v !== undefined && v !== '';
  }

  protected getAnswer(questionId: string): string {
    return this.answers().get(questionId) ?? '';
  }

  protected nextStep(): void {
    const total = this.visibleQuestions().length;
    const next = Math.min(this.currentStep() + 1, total);
    this.previewIfReady();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: next },
      queryParamsHandling: 'merge',
    });
  }

  protected prevStep(): void {
    const prev = Math.max(this.currentStep() - 1, 0);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: prev },
      queryParamsHandling: 'merge',
    });
  }

  protected goToStep(idx: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: idx },
      queryParamsHandling: 'merge',
    });
  }

  protected jumpToRecommendation(): void {
    this.previewIfReady();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: this.visibleQuestions().length },
      queryParamsHandling: 'merge',
    });
  }

  protected pickAlternative(alt: DiscoveryAlternative): void {
    this.chosenPresetId.set(alt.presetId);
  }

  protected resetToRecommended(): void {
    const rec = this.recommendation();
    if (!rec) return;
    this.chosenPresetId.set(rec.presetId);
  }

  protected applyRecommendation(): void {
    const rec = this.recommendation();
    if (!rec) return;
    const chosen = this.chosenPresetId() ?? rec.presetId;
    const chosenName = this.chosenPreset()?.name ?? rec.presetName;

    // Phase 4 Phase-H — route the apply through PresetApplyDialogComponent so
    // discovery shares the same review-and-confirm step as direct preset apply.
    // We borrow the preset preview endpoint (which returns deltas + violations
    // shaped exactly for the dialog) rather than reshaping the recommendation
    // payload, so the diff/violation rendering stays consistent across both
    // surfaces.
    this.presetService.previewApply(chosen).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (preview) => {
        const data: PresetApplyDialogData = {
          presetId: chosen,
          presetName: chosenName,
          isCustom: preview.isCustom,
          deltas: preview.deltas,
          violations: preview.violations,
          noOp: preview.deltaCount === 0,
          hideCodes: !this.consultantModeEnabled(),
        };
        this.dialog
          .open<PresetApplyDialogComponent, PresetApplyDialogData, PresetApplyDialogResult>(
            PresetApplyDialogComponent,
            { width: '720px', data },
          )
          .afterClosed()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((result) => {
            if (!result?.confirmed) return;
            this.commitApply(chosen, chosenName);
          });
      },
      error: (err: unknown) => {
        this.snackbar.errorFrom(err, 'discoveryWizard.previewFailed');
      },
    });
  }

  private commitApply(chosenPresetId: string, chosenPresetName: string): void {
    const adjustments = this.recommendation()?.capabilityAdjustments ?? [];
    const manualNumberKeys = this.manualNumberSettingKeys();
    this.discovery.apply(chosenPresetId).pipe(
      tap(() => this.installState.dismiss()),
      switchMap(() => this.applyAnswerFollowUps(adjustments, manualNumberKeys).pipe(
        map(() => true),
        catchError(() => of(false)),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (followUpsSaved) => {
        this.capabilityService.load().subscribe();
        this.router.navigate(['/dashboard']).then(() => {
          if (followUpsSaved) {
            this.snackbar.successWithNav(
              this.translate.instant('discoveryWizard.applied', { preset: chosenPresetName }),
              '/admin/capabilities',
              this.translate.instant('discoveryWizard.reviewCapabilities'));
          } else {
            this.snackbar.error(this.translate.instant('discoveryWizard.followUpFailed', { preset: chosenPresetName }));
          }
        });
      },
      error: (err: unknown) => {
        this.snackbar.errorFrom(err, 'discoveryWizard.applyFailed');
      },
    });
  }

  private applyAnswerFollowUps(
    adjustments: DiscoveryCapabilityAdjustment[],
    manualNumberKeys: string[],
  ): Observable<unknown> {
    return this.capabilityService.load().pipe(
      switchMap(() => {
        const changed = adjustments.filter((a) => this.capabilityService.isEnabled(a.code) !== a.enabled);
        const calls: Observable<unknown>[] = manualNumberKeys.map((key) => this.adminSettings.updateSetting(key, 'true'));
        if (changed.length > 0) {
          const reason = [...new Set(changed.map((a) => a.reason))].join(' ');
          calls.push(this.capabilityService.bulkToggle(changed.map((a) => ({ id: a.code, enabled: a.enabled })), reason));
        }
        return calls.length > 0 ? forkJoin(calls) : of(null);
      }),
    );
  }

  private manualNumberSettingKeys(): string[] {
    const question = this.discovery.questions().find((q) => q.id === 'Q-D8');
    const offered = new Set((question?.choices ?? []).map((c) => c.value));
    return this.selectedValues('Q-D8')
      .filter((v) => offered.has(v))
      .map((v) => `${v}.allow_manual_numbers`);
  }

  protected exitToCustom(): void {
    this.discovery.setAnswer('Q-X1', 'yes');
    this.previewIfReady();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: this.visibleQuestions().length },
      queryParamsHandling: 'merge',
    });
  }

  protected getRecommendedAndAlternativeDeltas(_altPresetId: string): DiscoveryRecommendation | null {
    // For full delta refresh on alt selection we'd call /preview again with
    // the picked preset — outside Phase F scope. The recommendation already
    // surfaces deltas for the recommended preset; alternative deltas are
    // computed on apply (cheaper).
    return this.recommendation();
  }

  /** Whether the user can advance from the current question. */
  protected canAdvance(): boolean {
    const q = this.currentQuestion();
    if (!q) return false;
    // Free-text and YesNoWithDetail are optional (the user can submit empty).
    if (q.type === 'FreeText' || q.type === 'MultiChoice') return true;
    return this.isAnswered(q.id);
  }

  /** Trigger a preview if the user has answered enough opening questions. */
  private previewIfReady(): void {
    if (!this.canPreview()) return;
    this.discovery.preview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => {
        // Suppress errors silently here — preview is optional. Errors get
        // surfaced via the global HTTP interceptor.
      },
    });
  }

  /** Get free-text textarea control, lazily creating one. */
  protected textareaControl(questionId: string): FormControl<string | null> {
    let c = this.textareaControls.get(questionId);
    if (!c) {
      c = new FormControl(this.getAnswer(questionId));
      this.textareaControls.set(questionId, c);
    }
    return c;
  }
}
