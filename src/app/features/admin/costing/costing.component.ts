import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { SchedulingService } from '../../scheduling/services/scheduling.service';
import { WorkCenter } from '../../scheduling/models/scheduling.model';
import { CostingService } from '../services/costing.service';

/**
 * Costing Tier 2 admin — configures the active costing profile. Toggling "departmental" switches the
 * standard-cost rollup from flat work-center burden rates to per-work-center overhead percentages of
 * direct labor (entered in the grid below). Work centers left blank fall back to their flat burden rate.
 * Admin/Manager can view; only Admin can save. The whole page is capability-gated at the route.
 */
@Component({
  selector: 'app-costing',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    PageLayoutComponent, ToggleComponent, InputComponent, EmptyStateComponent, LoadingBlockDirective,
  ],
  templateUrl: './costing.component.html',
  styleUrl: './costing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostingComponent implements OnInit {
  private readonly costingService = inject(CostingService);
  private readonly schedulingService = inject(SchedulingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly workCenters = signal<WorkCenter[]>([]);
  protected readonly canEdit = this.auth.hasRole('Admin');

  protected readonly departmentalControl = new FormControl<boolean>(false, { nonNullable: true });
  protected readonly departmental = toSignal(this.departmentalControl.valueChanges, { initialValue: false });

  /** One percent-of-labor control per active work center, keyed by work-center id. */
  protected readonly rateForm = new FormGroup<Record<string, FormControl<number | null>>>({});

  protected readonly hasWorkCenters = computed(() => this.workCenters().length > 0);

  /** Rows for the rate grid — precomputed control key + label avoid function calls in the template. */
  protected readonly rows = computed(() =>
    this.workCenters().map(wc => ({ id: wc.id, key: String(wc.id), label: `${wc.name} · ${wc.code}` })));

  ngOnInit(): void {
    forkJoin({
      profile: this.costingService.getProfile(),
      workCenters: this.schedulingService.getWorkCenters(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profile, workCenters }) => {
          const active = workCenters.filter(w => w.isActive);
          this.workCenters.set(active);

          const rateByWc = new Map(profile.departmentalRates.map(r => [r.workCenterId, r.ratePct]));
          for (const wc of active) {
            this.rateForm.addControl(
              String(wc.id),
              new FormControl<number | null>(rateByWc.get(wc.id) ?? null, [Validators.min(0)]),
            );
          }

          this.departmentalControl.setValue(profile.mode === 'departmental');
          if (!this.canEdit) {
            this.departmentalControl.disable();
            this.rateForm.disable();
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected rateControl(workCenterId: number): FormControl<number | null> {
    return this.rateForm.controls[String(workCenterId)];
  }

  protected save(): void {
    if (!this.canEdit) return;
    const departmental = this.departmentalControl.value;
    const rates = departmental
      ? this.workCenters()
          .map(wc => ({ workCenterId: wc.id, ratePct: this.rateControl(wc.id)?.value }))
          .filter((r): r is { workCenterId: number; ratePct: number } => r.ratePct != null)
      : [];

    this.saving.set(true);
    this.costingService.updateProfile({ mode: departmental ? 'departmental' : 'flat', departmentalRates: rates })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success(this.translate.instant('admin.costing.saved'));
        },
        error: () => this.saving.set(false),
      });
  }
}
