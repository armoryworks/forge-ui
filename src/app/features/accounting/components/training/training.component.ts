import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { filter, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TrainingService } from '../../services/training.service';
import { ScenarioCheckResult, TrainingSandboxState, TrainingScenario } from '../../models/accounting.models';

type Track = 'A' | 'B';
const TRACK_KEY = 'forge-training-track';
const PASSED_KEY = 'forge-training-passed';

/** The 8 crosswalk cards (Track B spine) — content lives in i18n under accounting.training.crosswalk.cN. */
const CROSSWALK_CARDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * §5A.4 two-track GL training: an intake router (from-scratch vs unlearn-QuickBooks), graded fix-it
 * scenarios validated by LEDGER END-STATE against the isolated TRAINING sandbox book, the QuickBooks
 * crosswalk cards, and a guided ledger tour. Learners do the actual work on the real ledger/editor
 * surfaces pointed at the sandbox via `?bookId=`.
 */
@Component({
  selector: 'app-training',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PageHeaderComponent],
  templateUrl: './training.component.html',
  styleUrl: './training.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingComponent implements OnInit {
  private readonly training = inject(TrainingService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<TrainingSandboxState | null>(null);
  protected readonly scenarios = signal<TrainingScenario[]>([]);
  protected readonly track = signal<Track | null>((localStorage.getItem(TRACK_KEY) as Track) || null);
  protected readonly passedIds = signal<Set<string>>(new Set(JSON.parse(localStorage.getItem(PASSED_KEY) ?? '[]') as string[]));
  protected readonly checking = signal<string | null>(null);
  protected readonly lastResult = signal<ScenarioCheckResult | null>(null);
  protected readonly revealedHints = signal<Record<string, number>>({});
  protected readonly crosswalkCards = CROSSWALK_CARDS;

  /** Scenarios for the chosen track, ordered; Track A skips B-only baits and vice versa. */
  protected readonly trackScenarios = computed(() => {
    const track = this.track();
    return this.scenarios()
      .filter((s) => s.track === 'both' || s.track === track)
      .sort((a, b) => a.order - b.order);
  });
  protected readonly passedCount = computed(() => this.trackScenarios().filter((s) => this.passedIds().has(s.id)).length);

  ngOnInit(): void {
    this.training.getState().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => this.state.set(s),
      error: () => this.snackbar.error(this.translate.instant('accounting.training.errors.stateFailed')),
    });
    this.training.getScenarios().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.scenarios.set(list),
      error: () => this.snackbar.error(this.translate.instant('accounting.training.errors.scenariosFailed')),
    });
  }

  protected chooseTrack(track: Track): void {
    this.track.set(track);
    localStorage.setItem(TRACK_KEY, track);
  }

  protected switchTrack(): void {
    this.track.set(null);
    localStorage.removeItem(TRACK_KEY);
  }

  protected revealHint(scenario: TrainingScenario): void {
    this.revealedHints.update((h) => ({ ...h, [scenario.id]: Math.min((h[scenario.id] ?? 0) + 1, scenario.hintKeys.length) }));
  }

  protected check(scenario: TrainingScenario): void {
    this.checking.set(scenario.id);
    this.training.check(scenario.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.lastResult.set(result);
        this.checking.set(null);
        if (result.passed) {
          this.passedIds.update((set) => {
            const next = new Set(set);
            next.add(scenario.id);
            localStorage.setItem(PASSED_KEY, JSON.stringify([...next]));
            return next;
          });
          this.snackbar.success(this.translate.instant(scenario.successKey));
        }
      },
      error: () => {
        this.checking.set(null);
        this.snackbar.error(this.translate.instant('accounting.training.errors.checkFailed'));
      },
    });
  }

  protected reset(): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.translate.instant('accounting.training.resetTitle'),
          message: this.translate.instant('accounting.training.resetMessage'),
          confirmLabel: this.translate.instant('accounting.training.resetConfirm'),
          severity: 'warn',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(
        filter((confirmed): confirmed is true => confirmed === true),
        switchMap(() => this.training.reset()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (s) => {
          this.state.set(s);
          this.lastResult.set(null);
          this.passedIds.set(new Set());
          localStorage.removeItem(PASSED_KEY);
          this.snackbar.success(this.translate.instant('accounting.training.resetDone'));
        },
        error: () => this.snackbar.error(this.translate.instant('accounting.training.errors.resetFailed')),
      });
  }
}
