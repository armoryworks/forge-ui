import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { CurrencyService } from '../../services/currency.service';

/**
 * Renders a monetary amount using the user's locale for numeric formatting,
 * with disambiguating ISO-code suffix when the record-level currency is
 * not the install's base currency.
 *
 * Why suffix the code instead of just using the symbol? Because $ alone
 * is ambiguous (USD vs CAD vs AUD vs MXN), and Intl.NumberFormat in any
 * given locale can pick a non-obvious symbol for unfamiliar currencies.
 * The ISO suffix is the unambiguous tiebreaker.
 *
 * Inputs:
 * - {@link value} — the numeric amount (required).
 * - {@link currency} — the record-level ISO code, or null to mean "this
 *   record is in the install's base currency" (e.g. manual cost overrides).
 * - {@link showCodeWhenBase} — opt-in to always-show the code, even when
 *   the record matches the base. Useful in audit / report contexts.
 */
@Component({
  selector: 'app-currency-display',
  standalone: true,
  templateUrl: './currency-display.component.html',
  styleUrl: './currency-display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyDisplayComponent {
  private readonly currencyService = inject(CurrencyService);

  readonly value = input.required<number>();
  readonly currency = input<string | null>(null);
  readonly showCodeWhenBase = input<boolean>(false);

  protected readonly formatted = computed(() => {
    const v = this.value();
    const recordCurrency = this.currency();
    const base = this.currencyService.baseCurrency();
    const effective = recordCurrency ?? base;

    // Intl.NumberFormat throws on a malformed currency code (anything not 3
    // letters / not in the runtime's list). Fall back to the install's base
    // when the record carries garbage so the cell still renders something
    // sensible instead of erroring out the whole row.
    let numStr: string;
    try {
      numStr = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: effective,
        currencyDisplay: 'symbol',
      }).format(v);
    } catch {
      numStr = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: base,
        currencyDisplay: 'symbol',
      }).format(v);
      return `${numStr} ${base}`;
    }

    if (effective !== base) {
      return `${numStr} ${effective}`;
    }
    if (this.showCodeWhenBase()) {
      return `${numStr} ${effective}`;
    }
    return numStr;
  });
}
