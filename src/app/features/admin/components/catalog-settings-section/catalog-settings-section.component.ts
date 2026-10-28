import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
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
import { CatalogSettingSection } from '../../models/catalog-setting-section.model';

type CatalogFieldKind = 'toggle' | 'select' | 'number' | 'text';

interface CatalogFieldRow {
  key: string;
  labelKey: string;
  hint: string | null;
  kind: CatalogFieldKind;
  options: SelectOption[];
}

/** One Admin > Settings section drawn from a settings-catalog group; Save writes the changed fields. */
@Component({
  selector: 'app-catalog-settings-section',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent, ToggleComponent, LoadingBlockDirective],
  templateUrl: './catalog-settings-section.component.html',
  styleUrl: './catalog-settings-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogSettingsSectionComponent implements OnInit {
  private readonly adminSettings = inject(AdminSettingsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly section = input.required<CatalogSettingSection>();

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly rows = signal<CatalogFieldRow[]>([]);
  protected form = new FormGroup<Record<string, FormControl<string | boolean>>>({});

  ngOnInit(): void {
    this.load();
  }

  protected save(): void {
    const changes = this.rows()
      .filter(row => this.form.controls[row.key].dirty)
      .map(row => {
        const value = this.form.controls[row.key].value;
        return { key: row.key, value: typeof value === 'string' ? value.trim() : String(value) };
      });
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
        this.snackbar.success(this.translate.instant('admin.settingsSaved'));
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
    this.adminSettings.getGroup(this.section().group).subscribe({
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
    const rows: CatalogFieldRow[] = [];
    for (const field of this.section().fields) {
      const entry = byKey.get(field.key);
      if (!entry) continue;
      const kind = CatalogSettingsSectionComponent.kindOf(entry);
      const initial: string | boolean = kind === 'toggle' ? entry.value?.toLowerCase() === 'true' : entry.value ?? '';
      form.addControl(field.key, new FormControl<string | boolean>(initial, { nonNullable: true }));
      rows.push({
        key: field.key,
        labelKey: field.labelKey,
        hint: entry.description,
        kind,
        options: (entry.choices ?? []).map(choice => ({ value: choice.value, label: choice.label })),
      });
    }
    this.form = form;
    this.rows.set(rows);
  }

  private static kindOf(entry: SettingsCatalogEntry): CatalogFieldKind {
    if (entry.dataType === 'Boolean') return 'toggle';
    if (entry.choices?.length) return 'select';
    if (entry.dataType === 'Integer') return 'number';
    return 'text';
  }
}
