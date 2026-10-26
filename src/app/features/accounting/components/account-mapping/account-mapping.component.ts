import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { GeneralLedgerService } from '../../services/general-ledger.service';
import { GlAccountAdmin } from '../../models/accounting.models';
import { DeterminationRule } from '../../models/determination-rule.model';

interface MappingRow {
  key: string;
  rule: DeterminationRule;
  label: string;
  options: SelectOption[];
  control: FormControl<number | null> | null;
}

/** Account mapping: which GL account each posting key (Freight Income, Freight-In, ...) resolves to; configurable keys can be re-pointed. */
@Component({
  selector: 'app-account-mapping',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SelectComponent, DataTableComponent, ColumnCellDirective],
  templateUrl: './account-mapping.component.html',
  styleUrl: './account-mapping.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountMappingComponent {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly bookId = input.required<number>();
  readonly accounts = input.required<GlAccountAdmin[]>();

  protected readonly rules = signal<DeterminationRule[]>([]);
  protected readonly loading = signal(false);
  protected readonly savingKey = signal<string | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'label', header: 'accounting.mapping.posting', sortable: true },
    { field: 'account', header: 'accounting.mapping.account' },
    { field: 'actions', header: '', align: 'right', width: '140px' },
  ];

  protected readonly rows = computed<MappingRow[]>(() => {
    const accounts = this.accounts();
    return this.rules().map(rule => {
      const labelKey = `accounting.mapping.keys.${rule.key}`;
      const translated = this.translate.instant(labelKey);
      const options: SelectOption[] = rule.configurable
        ? accounts
          .filter(a => a.isActive && a.isPostable && !a.isControlAccount && a.accountType === rule.requiredAccountType)
          .map(a => ({ value: a.id, label: `${a.accountNumber} — ${a.name}` }))
        : [];
      return {
        key: rule.key,
        rule,
        label: translated !== labelKey ? translated : rule.key,
        options,
        control: rule.configurable ? new FormControl<number | null>(rule.glAccountId) : null,
      };
    });
  });

  constructor() {
    effect(() => this.load(this.bookId()));
  }

  private load(bookId: number): void {
    this.loading.set(true);
    this.gl.getDeterminationRules(bookId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rules => { this.rules.set(rules); this.loading.set(false); },
      error: (err: unknown) => { this.snackbar.errorFrom(err, 'accounting.mapping.loadFailed'); this.loading.set(false); },
    });
  }

  protected save(row: MappingRow): void {
    const glAccountId = row.control?.value;
    if (glAccountId == null || glAccountId === row.rule.glAccountId) return;
    this.savingKey.set(row.rule.key);
    this.gl.updateDeterminationRule(row.rule.key, glAccountId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.rules.update(prev => prev.map(r => (r.key === updated.key ? updated : r)));
        this.savingKey.set(null);
        this.snackbar.success(this.translate.instant('accounting.mapping.saved', { key: row.label }));
      },
      error: (err: unknown) => {
        this.savingKey.set(null);
        this.snackbar.errorFrom(err, 'accounting.mapping.saveFailed');
      },
    });
  }
}
