import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { interval } from 'rxjs';

import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DurationMsPipe } from '../../../../shared/pipes/duration-ms.pipe';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AndonAlert } from '../../models/andon-alert.model';
import { AndonService } from '../../services/andon.service';

const REFRESH_MS = 15_000;

interface AndonRow {
  alert: AndonAlert;
  ageMs: number;
}

@Component({
  selector: 'app-andon-board',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DurationMsPipe, TextareaComponent],
  templateUrl: './andon-board.component.html',
  styleUrl: './andon-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AndonBoardComponent implements OnInit {
  private readonly andon = inject(AndonService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly canAct = input(false);
  readonly kiosk = input(false);

  protected readonly alerts = signal<AndonAlert[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly resolvingId = signal<number | null>(null);
  protected readonly resolveNote = new FormControl('', { nonNullable: true });
  private readonly now = signal(Date.now());

  protected readonly rows = computed<AndonRow[]>(() => {
    const now = this.now();
    return [...this.alerts()]
      .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt))
      .map(alert => ({ alert, ageMs: Math.max(0, now - Date.parse(alert.requestedAt)) }));
  });

  constructor() {
    interval(REFRESH_MS).pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.andon.getOpenAlerts(this.kiosk()).subscribe({
      next: alerts => {
        this.now.set(Date.now());
        this.alerts.set(alerts);
        this.loading.set(false);
        this.failed.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  protected acknowledge(alert: AndonAlert): void {
    if (!this.canAct() || this.busyId() !== null || alert.status !== 'Active') return;
    this.busyId.set(alert.id);
    this.andon.acknowledge(alert.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.snackbar.success(this.translate.instant('andon.acknowledged', { workCenter: alert.workCenterName }));
        this.load();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.snackbar.errorFrom(err, 'andon.actionFailed');
        this.load();
      },
    });
  }

  protected startResolve(alert: AndonAlert): void {
    if (!this.canAct()) return;
    this.resolveNote.reset();
    this.resolvingId.set(alert.id);
  }

  protected cancelResolve(): void {
    this.resolvingId.set(null);
  }

  protected confirmResolve(alert: AndonAlert): void {
    if (!this.canAct() || this.busyId() !== null) return;
    this.busyId.set(alert.id);
    this.andon.resolve(alert.id, this.resolveNote.value.trim() || null).subscribe({
      next: () => {
        this.busyId.set(null);
        this.resolvingId.set(null);
        this.snackbar.success(this.translate.instant('andon.resolved', { workCenter: alert.workCenterName }));
        this.load();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.snackbar.errorFrom(err, 'andon.actionFailed');
        this.load();
      },
    });
  }
}
