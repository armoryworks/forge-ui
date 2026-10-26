import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { of, startWith, switchMap } from 'rxjs';

import { InputComponent } from '../input/input.component';
import { SelectComponent, SelectOption } from '../select/select.component';
import { CurrencyCatalogService } from '../../services/currency-catalog.service';
import { ExchangeRateLookupService } from '../../services/exchange-rate-lookup.service';
import { formatDate, parseDateOnly } from '../../utils/date.utils';

/** The rate note under the field: where the pre-filled rate came from, or that none is on file. */
type RateNote = { kind: 'asOf'; date: string } | { kind: 'missing' } | null;

/**
 * Currency select and exchange-rate field for a document or party form. Shown only when the
 * install has more than one active currency and CAP-MD-CURRENCIES is on. Defaults the currency
 * from {@link defaultCurrencyId} (the party's currency) until the user picks one. For a foreign
 * currency it pre-fills the rate the server would book on {@link documentDate} with an
 * "as of" note; the functional currency always books at 1 and its rate field is hidden.
 * A null rate means "let the server look it up".
 */
@Component({
  selector: 'app-document-currency',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SelectComponent, InputComponent],
  templateUrl: './document-currency.component.html',
  styleUrl: './document-currency.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentCurrencyComponent {
  private readonly catalog = inject(CurrencyCatalogService).ensureLoaded();
  private readonly rates = inject(ExchangeRateLookupService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currencyControl = input.required<FormControl<number | null>>();
  readonly fxRateControl = input<FormControl<number | null> | null>(null);
  readonly documentDate = input<Date | null>(null);
  readonly defaultCurrencyId = input<number | null>(null);
  readonly locked = input(false);
  readonly readonly = input(false);
  readonly canEditRate = input(true);
  readonly testIdPrefix = input('document');

  protected readonly currencies = this.catalog.currencies;
  protected readonly rateNote = signal<RateNote>(null);
  protected readonly rateAsOf = computed(() => {
    const note = this.rateNote();
    return note?.kind === 'asOf' ? note.date : null;
  });
  protected readonly rateMissing = computed(() => this.rateNote()?.kind === 'missing');

  readonly baseCurrencyId = computed<number | null>(
    () => this.currencies().find(c => c.isBaseCurrency)?.id ?? this.currencies()[0]?.id ?? null,
  );
  readonly visible = this.catalog.isMultiCurrency;
  protected readonly options = computed<SelectOption[]>(() =>
    this.currencies().map(c => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  );
  /** ISO code of the chosen currency; null while the list loads or on a single-currency install. */
  readonly selectedCode = computed(() => {
    if (!this.visible()) return null;
    const id = this.selectedId();
    return this.currencies().find(c => c.id === id)?.code ?? null;
  });
  protected readonly lockedLabel = computed(() => {
    const id = this.selectedId() ?? this.defaultCurrencyId() ?? this.baseCurrencyId();
    const c = this.currencies().find(x => x.id === id);
    return c ? `${c.code} — ${c.name}` : '';
  });

  private appliedDefault: number | null = null;

  private readonly selectedId = toSignal(
    toObservable(this.currencyControl).pipe(
      switchMap(control => control ? control.valueChanges.pipe(startWith(control.value)) : of(null)),
    ),
    { initialValue: null },
  );

  readonly isForeign = computed(() => {
    const base = this.baseCurrencyId();
    const selected = this.selectedId();
    return base !== null && selected !== null && selected !== base;
  });
  protected readonly showRate = computed(() => this.visible() && this.isForeign() && this.fxRateControl() !== null);

  constructor() {
    effect(() => {
      const control = this.currencyControl();
      const fallback = this.defaultCurrencyId() ?? this.baseCurrencyId();
      if (fallback === null || this.locked() || this.readonly()) return;
      untracked(() => {
        const followsDefault = control.value === null || control.value === this.appliedDefault;
        this.appliedDefault = fallback;
        if (!control.dirty && followsDefault && control.value !== fallback) control.setValue(fallback);
      });
    });

    effect(() => {
      const rateControl = this.fxRateControl();
      const foreign = this.isForeign();
      const selected = this.selectedId();
      const date = this.documentDate();
      if (!rateControl || selected === null || this.locked()) return;
      untracked(() => {
        if (!foreign) {
          rateControl.setValue(1);
          this.rateNote.set(null);
          return;
        }
        if (rateControl.dirty) return;
        this.rates.lookup(selected, date)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: quote => {
              if (rateControl.dirty) return;
              rateControl.setValue(quote.rate);
              const asOf = quote.effectiveDate ? parseDateOnly(quote.effectiveDate.slice(0, 10)) : null;
              this.rateNote.set(asOf ? { kind: 'asOf', date: formatDate(asOf) } : null);
            },
            error: () => {
              if (rateControl.dirty) return;
              rateControl.setValue(null);
              this.rateNote.set({ kind: 'missing' });
            },
          });
      });
    });
  }
}
