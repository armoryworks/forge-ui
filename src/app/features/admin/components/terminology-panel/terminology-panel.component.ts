import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map, startWith } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TerminologyService } from '../../../../shared/services/terminology.service';
import {
  TERM_CATALOG, TermDefinition, catalogKeys, genderKey, pluralKey, singularKey,
} from '../../../../shared/terminology/term-catalog';
import { pluralize } from '../../../../shared/terminology/term-substitution';
import { AdminService } from '../../services/admin.service';
import { TerminologyEntryItem } from '../../models/terminology-entry-item.model';

interface TermRow {
  id: string;
  enOne: string;
  enOther: string;
  esOne: string;
  esOther: string;
  esGender: string;
  keys: { enOne: string; enOther: string; esOne: string; esOther: string; esGender: string };
}

@Component({
  selector: 'app-terminology-panel',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, SelectComponent, LoadingBlockDirective, TranslatePipe],
  templateUrl: './terminology-panel.component.html',
  styleUrl: './terminology-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologyPanelComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly terminology = inject(TerminologyService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly original = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly otherKeys = signal<string[]>([]);

  protected readonly rows: TermRow[] = TERM_CATALOG.map(term => toRow(term));
  protected readonly form = new FormRecord<FormControl<string>>({});

  private readonly values = toSignal(
    this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue() as Record<string, string>)),
    { initialValue: {} as Record<string, string> },
  );

  protected readonly dirty = computed(() => this.changes(this.values(), this.original()).length > 0);
  protected readonly hasValues = computed(() => Object.values(this.values()).some(v => v.trim().length > 0));

  constructor() {
    for (const key of catalogKeys()) {
      this.form.addControl(key, new FormControl('', { nonNullable: true }));
    }
  }

  ngOnInit(): void {
    this.load();
  }

  protected control(key: string): FormControl<string> {
    return this.form.controls[key];
  }

  protected genderOptions(row: TermRow): SelectOption[] {
    const defaultLabel = this.translate.instant(
      row.esGender === 'f' ? 'adminPanels.terminology.genderDefaultFeminine' : 'adminPanels.terminology.genderDefaultMasculine',
    );
    return [
      { value: '', label: defaultLabel },
      { value: 'm', label: this.translate.instant('adminPanels.terminology.genderMasculine') },
      { value: 'f', label: this.translate.instant('adminPanels.terminology.genderFeminine') },
    ];
  }

  protected enPluralHint(row: TermRow): string {
    const singular = this.values()[row.keys.enOne]?.trim();
    return singular ? pluralize(singular, 'en') : row.enOther;
  }

  protected esPluralHint(row: TermRow): string {
    const singular = this.values()[row.keys.esOne]?.trim();
    return singular ? pluralize(singular, 'es') : row.esOther;
  }

  protected isOverridden(row: TermRow): boolean {
    const values = this.values();
    return Object.values(row.keys).some(key => (values[key] ?? '').trim().length > 0);
  }

  protected resetRow(row: TermRow): void {
    for (const key of Object.values(row.keys)) this.control(key).setValue('');
  }

  protected resetAll(): void {
    for (const control of Object.values(this.form.controls)) control.setValue('');
  }

  protected save(): void {
    const entries = this.changes(this.form.getRawValue() as Record<string, string>, this.original());
    if (entries.length === 0) return;
    this.saving.set(true);
    this.adminService.updateTerminology(entries).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.applyLoaded(updated);
        this.terminology.applyEntries(updated);
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('admin.terminologySaved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'admin.terminologySaveFailed');
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.adminService.getTerminology().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: entries => {
        this.applyLoaded(entries);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  private applyLoaded(entries: TerminologyEntryItem[]): void {
    const known = catalogKeys();
    const original = new Map(entries.map(e => [e.key, e.label] as const));
    const others = entries.map(e => e.key).filter(key => !known.has(key)).sort();
    for (const key of others) {
      if (!this.form.contains(key)) this.form.addControl(key, new FormControl('', { nonNullable: true }));
    }
    for (const key of Object.keys(this.form.controls)) {
      if (!known.has(key) && !original.has(key)) this.form.removeControl(key);
    }
    this.original.set(original);
    this.otherKeys.set(others);
    this.form.reset(Object.fromEntries(Object.keys(this.form.controls).map(key => [key, original.get(key) ?? ''])));
  }

  private changes(values: Record<string, string>, original: ReadonlyMap<string, string>): TerminologyEntryItem[] {
    return Object.entries(values)
      .map(([key, value]) => ({ key, label: (value ?? '').trim() }))
      .filter(entry => entry.label !== (original.get(entry.key) ?? ''));
  }
}

function toRow(term: TermDefinition): TermRow {
  const enForms = term.locales['en'].forms;
  const esForms = term.locales['es'].forms;
  return {
    id: term.id,
    enOne: enForms.find(f => !f.plural)?.text ?? '',
    enOther: enForms.find(f => f.plural)?.text ?? '',
    esOne: esForms.find(f => !f.plural)?.text ?? '',
    esOther: esForms.find(f => f.plural)?.text ?? '',
    esGender: esForms[0]?.gender ?? 'm',
    keys: {
      enOne: singularKey(term, 'en'),
      enOther: pluralKey(term, 'en'),
      esOne: singularKey(term, 'es'),
      esOther: pluralKey(term, 'es'),
      esGender: genderKey(term, 'es'),
    },
  };
}
