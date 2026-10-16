import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { RecalculatedStandardCost } from '../../models/recalculated-standard-cost.model';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

/**
 * Part Cost tab — standard-cost roll. Rolls the part's BOM + routing cost up and freezes it as the
 * current cost-calculation snapshot, then shows the material / labor / overhead split of that roll.
 * Offered to the roles that maintain costing; emits `rolled` so the parent reloads the part.
 */
@Component({
  selector: 'app-part-standard-cost-roll',
  standalone: true,
  imports: [TranslatePipe, CurrencyDisplayComponent, LoadingBlockDirective],
  templateUrl: './part-standard-cost-roll.component.html',
  styleUrl: './part-standard-cost-roll.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartStandardCostRollComponent {
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly partId = input.required<number>();
  readonly rolled = output<RecalculatedStandardCost>();

  protected readonly canRoll = inject(AuthService).hasAnyRole(['Admin', 'Manager', 'Engineer']);
  protected readonly rolling = signal(false);
  protected readonly result = signal<RecalculatedStandardCost | null>(null);

  protected recalculate(): void {
    if (this.rolling()) return;
    this.rolling.set(true);
    this.partsService.recalculateStandardCost(this.partId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roll) => {
          this.rolling.set(false);
          this.result.set(roll);
          this.snackbar.success(this.translate.instant('parts.standardCost.rolled'));
          this.rolled.emit(roll);
        },
        error: (err: unknown) => {
          this.rolling.set(false);
          this.snackbar.errorFrom(err, 'parts.standardCost.rollFailed');
        },
      });
  }
}
