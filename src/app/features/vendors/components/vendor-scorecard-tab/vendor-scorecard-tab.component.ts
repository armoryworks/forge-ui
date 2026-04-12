import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

import { VendorService } from '../../services/vendor.service';
import { VendorGrade, VendorScorecard } from '../../models/vendor-scorecard.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { KpiChipComponent } from '../../../../shared/components/kpi-chip/kpi-chip.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-vendor-scorecard-tab',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, LoadingBlockDirective, KpiChipComponent, EmptyStateComponent],
  templateUrl: './vendor-scorecard-tab.component.html',
  styleUrl: './vendor-scorecard-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorScorecardTabComponent implements OnInit {
  private readonly vendorService = inject(VendorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vendorId = input.required<number>();

  protected readonly scorecard = signal<VendorScorecard | null>(null);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.loadScorecard();
  }

  protected gradeClass(grade: VendorGrade): string {
    switch (grade) {
      case 'A': return 'success';
      case 'B': return 'info';
      case 'C': return 'warning';
      case 'D': return 'error';
      case 'F': return 'error';
    }
  }

  private loadScorecard(): void {
    this.loading.set(true);
    this.vendorService.getVendorScorecard(this.vendorId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.scorecard.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
