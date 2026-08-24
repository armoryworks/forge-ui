import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { DecimalPipe } from '@angular/common';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ViewModeToggleComponent } from '../../../../shared/components/view-mode-toggle/view-mode-toggle.component';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';
import {
  ACCOUNTING_VIEW_PREF_KEY,
  AccountingViewMode,
  DEFAULT_ACCOUNTING_VIEW,
} from '../../../../shared/models/accounting-view.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { BalanceSheet } from '../../models/accounting.models';
import { BalanceSheetVisualComponent } from './balance-sheet-visual.component';

const DEFAULT_BOOK_ID = 1;

@Component({
  selector: 'app-balance-sheet',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    CurrencyDisplayComponent,
    ToggleComponent,
    ViewModeToggleComponent,
    BalanceSheetVisualComponent,
  ],
  templateUrl: './balance-sheet.component.html',
  styleUrl: './balance-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceSheetComponent {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly preferences = inject(UserPreferencesService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<BalanceSheet | null>(null);

  /** URL ?view= wins; otherwise the user's saved accounting-view default; else classic. */
  private readonly preferredView = (): AccountingViewMode =>
    this.preferences.get<AccountingViewMode>(ACCOUNTING_VIEW_PREF_KEY) ?? DEFAULT_ACCOUNTING_VIEW;
  protected readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => (p.get('view') as AccountingViewMode) ?? this.preferredView()),
    ),
    { initialValue: this.preferredView() },
  );

  /** Prior-date comparison state, mirrored to `?compare=1` (URL is source of truth). */
  protected readonly compare = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('compare') === '1')),
    { initialValue: false },
  );
  protected readonly compareControl = new FormControl<boolean>(false, { nonNullable: true });

  protected setViewMode(mode: AccountingViewMode): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode === DEFAULT_ACCOUNTING_VIEW ? null : mode },
      queryParamsHandling: 'merge',
    });
    this.preferences.set(ACCOUNTING_VIEW_PREF_KEY, mode);
  }

  constructor() {
    autoRefreshOnGlChange(() => this.load());

    // Keep the toggle control in sync with the URL without looping back.
    effect(() => {
      const on = this.compare();
      if (this.compareControl.value !== on) this.compareControl.setValue(on, { emitEvent: false });
    });

    // Toggle → URL.
    this.compareControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((on) => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { compare: on ? '1' : null },
        queryParamsHandling: 'merge',
      });
    });

    // URL compare state drives the (re)load. Runs on init and whenever it flips.
    effect(() => {
      this.compare();
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getBalanceSheet(DEFAULT_BOOK_ID, null, this.compare())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.balanceSheetLoadFailed'));
          this.loading.set(false);
        },
      });
  }
}
