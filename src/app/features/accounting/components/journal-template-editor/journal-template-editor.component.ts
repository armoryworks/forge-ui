import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { forkJoin, of } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { HasDirtyForm } from '../../../../shared/guards/unsaved-changes.guard';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GlAccount } from '../../models/accounting.models';
import { DeterminationRule } from '../../models/determination-rule.model';
import { JournalPartyType, JournalTemplate, JournalTemplateLine } from '../../models/journal-template.model';
import { JournalTemplateInput } from '../../models/journal-template-input.model';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { JournalTemplateService } from '../../services/journal-template.service';
import { bookIdFromParams } from '../../utils/statement-period';

interface TemplateLineValue {
  accountKey: string | null;
  glAccountId: number | null;
  debit: number | null;
  credit: number | null;
  description: string;
  partyType: JournalPartyType | null;
  partyId: number | null;
  partyName: string;
}

function templateLineValidator(control: AbstractControl): ValidationErrors | null {
  const debit = Number(control.get('debit')?.value) || 0;
  const credit = Number(control.get('credit')?.value) || 0;
  if (debit < 0 || credit < 0) return { negativeAmount: true };
  if (debit > 0 && credit > 0) return { bothSides: true };
  if (!control.get('accountKey')?.value && !control.get('glAccountId')?.value) return { noAccount: true };
  return null;
}

function controlLinesNamePartyValidator(isControl: (line: AbstractControl) => boolean, message: () => string) {
  return (group: AbstractControl): ValidationErrors | null => {
    const lines = (group.get('lines') as FormArray | null)?.controls ?? [];
    const missing = lines.some((line) => isControl(line) && !(line.get('partyType')?.value && line.get('partyId')?.value));
    return missing ? { partyRequired: { message: message() } } : null;
  };
}

function fixedTemplateBalanced(message: () => string) {
  return (group: AbstractControl): ValidationErrors | null => {
    const lines = (group.get('lines') as FormArray | null)?.controls ?? [];
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      const d = Number(line.get('debit')?.value) || 0;
      const c = Number(line.get('credit')?.value) || 0;
      if (d === 0 && c === 0) return null;
      debit += d;
      credit += c;
    }
    return Math.abs(debit - credit) < 0.005 ? null : { unbalanced: { message: message() } };
  };
}

/**
 * Create or edit a journal template: name, memo, auto-reverse, and lines with an account (or the determination
 * key an existing template carries), a fixed debit or credit or none (entered when posting), a description and,
 * on a control account, the customer or vendor. A template whose every line has an amount must balance.
 * Controller, CAP-ACCT-FULLGL.
 */
@Component({
  selector: 'app-journal-template-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, PageLayoutComponent, InputComponent, SelectComponent, ToggleComponent,
    CurrencyInputComponent, CurrencyDisplayComponent, EntityPickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './journal-template-editor.component.html',
  styleUrl: './journal-template-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalTemplateEditorComponent implements OnInit, HasDirtyForm {
  private readonly service = inject(JournalTemplateService);
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly templateId = signal<number | null>(null);
  private bookId = 1;
  private readonly accounts = signal<GlAccount[]>([]);
  private readonly rules = signal<DeterminationRule[]>([]);

  protected readonly form = new FormGroup(
    {
      name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
      description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
      memo: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
      autoReverseNextPeriod: new FormControl<boolean>(false, { nonNullable: true }),
      isActive: new FormControl<boolean>(true, { nonNullable: true }),
      lines: new FormArray<FormGroup>([this.buildLine(), this.buildLine()]),
    },
    {
      validators: [
        fixedTemplateBalanced(() => this.translate.instant('accounting.journalTemplates.unbalanced')),
        controlLinesNamePartyValidator(
          (line) => this.isControlLine(line),
          () => this.translate.instant('accounting.journalTemplates.partyRequired'),
        ),
      ],
    },
  );

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly accountOptions = computed<SelectOption[]>(() =>
    this.accounts().map((a) => ({ value: a.id, label: `${a.accountNumber} — ${a.name}` })));

  protected readonly partyTypeOptions: SelectOption[] = [
    { value: 'Customer', label: this.translate.instant('accounting.journalTemplates.customer') },
    { value: 'Vendor', label: this.translate.instant('accounting.journalTemplates.vendor') },
  ];

  /** Per line: whether its account is a control account (party required) and how a key line resolves. */
  protected readonly lineInfo = computed(() => {
    const lines = this.form.controls.lines.getRawValue() as Partial<TemplateLineValue>[];
    this.formValue();
    const byId = new Map(this.accounts().map((a) => [a.id, a]));
    const rules = new Map(this.rules().map((r) => [r.key, r]));
    return lines.map((line) => {
      const rule = line.accountKey ? rules.get(line.accountKey) : undefined;
      const accountId = line.accountKey ? rule?.glAccountId ?? null : line.glAccountId ?? null;
      const account = accountId !== null ? byId.get(accountId) : undefined;
      return {
        isControl: !!account?.isControlAccount,
        keyLabel: line.accountKey
          ? `${line.accountKey} → ${rule?.accountNumber ?? '?'} ${rule?.accountName ?? ''}`.trim()
          : null,
        partyFilters: { partyType: line.partyType ?? 'Customer' },
        partyType: line.partyType ?? null,
        partyName: line.partyId ? line.partyName ?? '' : '',
      };
    });
  });

  protected readonly totals = computed(() => {
    const lines = (this.formValue()?.lines ?? []) as Partial<TemplateLineValue>[];
    return {
      debit: lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0),
      credit: lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0),
      open: lines.filter((l) => !Number(l.debit) && !Number(l.credit)).length,
    };
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('accounting.journalTemplates.name'),
    description: this.translate.instant('accounting.common.description'),
    memo: this.translate.instant('accounting.journalEditor.memo'),
  });

  protected get lines(): FormArray<FormGroup> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    this.bookId = bookIdFromParams(this.route.snapshot.queryParamMap);
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.templateId.set(id > 0 ? id : null);

    forkJoin({
      accounts: this.gl.getChartOfAccounts(this.bookId, true),
      rules: this.gl.getDeterminationRules(this.bookId),
      template: id > 0 ? this.service.get(id) : of(null),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ accounts, rules, template }) => {
          this.accounts.set(accounts);
          this.rules.set(rules);
          if (template) this.patch(template);
          this.form.updateValueAndValidity();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'accounting.journalTemplates.loadFailed'),
      });
  }

  isDirty(): boolean {
    return this.form.dirty && !this.saving();
  }

  protected addLine(): void {
    this.lines.push(this.buildLine());
    this.form.markAsDirty();
  }

  protected removeLine(index: number): void {
    if (this.lines.length <= 2) return;
    this.lines.removeAt(index);
    this.form.markAsDirty();
  }

  protected onPartySelected(index: number, entity: Record<string, unknown> | null): void {
    this.lines.at(index).patchValue({ partyName: String(entity?.['name'] ?? '') });
  }

  protected clearParty(index: number): void {
    this.lines.at(index).patchValue({ partyId: null, partyName: '' });
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    const info = this.lineInfo();
    const lines: JournalTemplateLine[] = this.lines.controls.map((control, i) => {
      const line = control.getRawValue() as TemplateLineValue;
      const party = info[i]?.isControl && !!line.partyType && !!line.partyId;
      return {
        accountDeterminationKey: line.accountKey,
        glAccountId: line.accountKey ? null : line.glAccountId,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
        description: line.description.trim() || null,
        partyType: party ? line.partyType : null,
        partyId: party ? line.partyId : null,
      };
    });
    const input: JournalTemplateInput = {
      name: raw.name.trim(),
      description: raw.description.trim() || null,
      memo: raw.memo.trim() || null,
      autoReverseNextPeriod: raw.autoReverseNextPeriod,
      lines,
    };
    const id = this.templateId();
    const save$ = id
      ? this.service.update(id, { ...input, isActive: raw.isActive })
      : this.service.create({ ...input, bookId: this.bookId });
    this.saving.set(true);
    save$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.form.markAsPristine();
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('accounting.journalTemplates.saved', { name: saved.name }));
        this.router.navigate(['/accounting/journal-templates']);
      },
      error: () => this.saving.set(false),
    });
  }

  protected cancel(): void {
    this.router.navigate(['/accounting/journal-templates']);
  }

  private patch(template: JournalTemplate): void {
    this.form.patchValue({
      name: template.name,
      description: template.description ?? '',
      memo: template.memo ?? '',
      autoReverseNextPeriod: template.autoReverseNextPeriod,
      isActive: template.isActive,
    });
    const needed = Math.max(template.lines.length, 2);
    while (this.lines.length > needed) this.lines.removeAt(this.lines.length - 1);
    while (this.lines.length < needed) this.lines.push(this.buildLine());
    template.lines.forEach((line, i) => {
      const group = this.lines.at(i);
      group.patchValue({
        accountKey: line.accountDeterminationKey,
        glAccountId: line.glAccountId,
        debit: line.debit || null,
        credit: line.credit || null,
        description: line.description ?? '',
        partyType: line.partyType,
        partyId: line.partyId,
        partyName: '',
      });
      this.applyAccountRule(group);
      if (line.partyType && line.partyId) {
        this.service.searchParties(line.partyType, null, line.partyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (parties) => group.patchValue({ partyName: parties[0]?.name ?? `#${line.partyId}` }),
        });
      }
    });
    this.form.markAsPristine();
  }

  private isControlLine(line: AbstractControl): boolean {
    const key = line.get('accountKey')?.value as string | null;
    const accountId = key
      ? this.rules().find((r) => r.key === key)?.glAccountId ?? null
      : (line.get('glAccountId')?.value as number | null);
    return accountId !== null && !!this.accounts().find((a) => a.id === accountId)?.isControlAccount;
  }

  private applyAccountRule(group: FormGroup): void {
    const account = group.get('glAccountId')!;
    if (group.get('accountKey')!.value) account.disable({ emitEvent: false });
    else account.enable({ emitEvent: false });
  }

  private buildLine(): FormGroup {
    const group = new FormGroup(
      {
        accountKey: new FormControl<string | null>(null),
        glAccountId: new FormControl<number | null>(null),
        debit: new FormControl<number | null>(null),
        credit: new FormControl<number | null>(null),
        description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
        partyType: new FormControl<JournalPartyType | null>(null),
        partyId: new FormControl<number | null>(null),
        partyName: new FormControl<string>('', { nonNullable: true }),
      },
      { validators: [templateLineValidator] },
    );
    group.controls.partyType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => group.patchValue({ partyId: null, partyName: '' }, { emitEvent: false }));
    return group;
  }
}
