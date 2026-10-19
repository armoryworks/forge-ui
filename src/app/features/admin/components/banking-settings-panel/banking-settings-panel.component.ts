import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { concatMap, from, toArray } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AdminSettingsService } from '../../settings/services/admin-settings.service';
import { SettingsCatalogEntry } from '../../settings/models/setting-entry.model';
import { BANKING_SETTING_SECTIONS } from '../../models/banking-setting-sections.const';
import { BankingSettingField } from '../../models/banking-setting-field.model';

type BankingFieldKind = 'toggle' | 'select' | 'secret' | 'number' | 'text';

interface BankingFieldRow {
  key: string;
  field: BankingSettingField;
  kind: BankingFieldKind;
  options: SelectOption[];
  secretStored: boolean;
}

interface BankingSectionView {
  id: string;
  titleKey: string;
  rows: BankingFieldRow[];
}

@Component({
  selector: 'app-banking-settings-panel',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent, ToggleComponent, LoadingBlockDirective],
  templateUrl: './banking-settings-panel.component.html',
  styleUrl: './banking-settings-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankingSettingsPanelComponent {
  private readonly adminSettings = inject(AdminSettingsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly sections = signal<BankingSectionView[]>([]);
  protected form = new FormGroup<Record<string, FormControl<string | boolean>>>({});

  constructor() {
    this.load();
  }

  protected control(key: string): FormControl<string | boolean> {
    return this.form.controls[key];
  }

  protected save(): void {
    const changes = this.sections()
      .flatMap(section => section.rows)
      .filter(row => this.control(row.key).dirty)
      .map(row => ({ row, value: this.control(row.key).value }))
      .filter(({ row, value }) => !(row.kind === 'secret' && value === ''))
      .map(({ row, value }) => ({ key: row.key, value: typeof value === 'boolean' ? String(value) : value.trim() }));

    if (changes.length === 0) {
      this.form.markAsPristine();
      return;
    }

    this.saving.set(true);
    from(changes).pipe(
      concatMap(change => this.adminSettings.updateSetting(change.key, change.value === '' ? null : change.value)),
      toArray(),
    ).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('adminBanking.saved'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'admin.settingsSaveFailed');
        this.load();
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.adminSettings.getGroup('Banking').subscribe({
      next: entries => {
        this.build(entries);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.snackbar.errorFrom(err, 'admin.loadSettingsFailed');
      },
    });
  }

  private build(entries: SettingsCatalogEntry[]): void {
    const byKey = new Map(entries.map(entry => [entry.key, entry]));
    const form = new FormGroup<Record<string, FormControl<string | boolean>>>({});
    const sections: BankingSectionView[] = [];

    for (const section of BANKING_SETTING_SECTIONS) {
      const rows: BankingFieldRow[] = [];
      for (const field of section.fields) {
        const entry = byKey.get(field.key);
        if (!entry) continue;
        const kind = BankingSettingsPanelComponent.kindOf(entry, field);
        const initial: string | boolean = kind === 'toggle'
          ? entry.value?.toLowerCase() === 'true'
          : kind === 'secret' ? '' : entry.value ?? '';
        form.addControl(field.key, new FormControl<string | boolean>(initial, { nonNullable: true }));
        rows.push({
          key: field.key,
          field,
          kind,
          options: (field.choices ?? []).map(choice => ({ value: choice, label: choice })),
          secretStored: entry.isSecret && entry.hasValue,
        });
      }
      if (rows.length > 0) sections.push({ id: section.id, titleKey: section.titleKey, rows });
    }

    this.form = form;
    this.sections.set(sections);
  }

  private static kindOf(entry: SettingsCatalogEntry, field: BankingSettingField): BankingFieldKind {
    if (entry.dataType === 'Boolean') return 'toggle';
    if (entry.isSecret || entry.dataType === 'Secret') return 'secret';
    if (field.choices?.length) return 'select';
    if (entry.dataType === 'Integer') return 'number';
    return 'text';
  }
}
