import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { CreditMemoService } from '../../../credit-memos/services/credit-memo.service';
import { CreditMemoListItem } from '../../../credit-memos/models/credit-memo-list-item.model';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';

interface CurrencyTotal {
  currencyCode: string | null;
  amount: number;
}

@Component({
  selector: 'app-open-credits-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CurrencyDisplayComponent],
  templateUrl: './open-credits-card.component.html',
  styleUrl: './open-credits-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenCreditsCardComponent implements OnInit {
  private readonly service = inject(CreditMemoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customerId = input.required<number>();

  protected readonly memos = signal<CreditMemoListItem[]>([]);
  protected readonly totals = computed<CurrencyTotal[]>(() => {
    const byCurrency = new Map<string | null, number>();
    for (const memo of this.memos())
      byCurrency.set(memo.currencyCode, Math.round(((byCurrency.get(memo.currencyCode) ?? 0) + memo.openAmount) * 100) / 100);
    return [...byCurrency.entries()].map(([currencyCode, amount]) => ({ currencyCode, amount }));
  });

  ngOnInit(): void {
    this.service.getCreditMemos({ customerId: this.customerId(), openOnly: true }).pipe(
      catchError(() => of<CreditMemoListItem[]>([])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(list => this.memos.set(list));
  }
}
