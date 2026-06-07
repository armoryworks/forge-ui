import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { ArAging } from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;

@Component({
  selector: 'app-ar-aging',
  standalone: true,
  imports: [PageHeaderComponent, CurrencyDisplayComponent],
  templateUrl: './ar-aging.component.html',
  styleUrl: './ar-aging.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArAgingComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<ArAging | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getArAging(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load the AR aging.');
          this.loading.set(false);
        },
      });
  }
}
