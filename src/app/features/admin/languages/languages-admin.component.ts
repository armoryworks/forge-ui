import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { LanguageService } from '../../../shared/services/language.service';
import { I18nOverridesService } from '../../../shared/services/i18n-overrides.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { downloadBlob } from '../../../shared/utils/download-blob';
import { downloadCsv } from '../../../shared/utils/download-csv';
import { TranslationTransferService } from '../services/translation-transfer.service';
import { TranslationImportPlan } from '../models/translation-import-plan.model';
import { buildExportRows, exportCsvRows, nestCatalog, parseTranslationFile, planImport } from './translation-transfer.utils';

/**
 * Admin > Languages: export a language's full catalog (shipped text with this install's overrides on top,
 * flagged) as CSV or JSON, and import an edited file back. The import previews the keys whose text changes
 * and stores only those; text equal to the shipped catalog reverts to it.
 */
@Component({
  selector: 'app-languages-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, PageLayoutComponent, SelectComponent, DataTableComponent,
    ColumnCellDirective, LoadingBlockDirective, SpacerDirective,
  ],
  templateUrl: './languages-admin.component.html',
  styleUrl: './languages-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguagesAdminComponent {
  private readonly transfer = inject(TranslationTransferService);
  private readonly overridesService = inject(I18nOverridesService);
  private readonly languageService = inject(LanguageService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly languageOptions: SelectOption[] = this.languageService.availableLanguages
    .map(l => ({ value: l.code, label: l.label }));
  protected readonly languageControl = new FormControl<string>('es', { nonNullable: true });

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  private readonly shipped = signal<Record<string, string>>({});
  private readonly overrides = signal<Record<string, string>>({});
  protected readonly fileName = signal<string | null>(null);
  protected readonly plan = signal<TranslationImportPlan | null>(null);
  protected readonly unreadable = signal(false);

  protected readonly keyCount = computed(() => Object.keys(this.shipped()).length);
  protected readonly overrideCount = computed(() => buildExportRows(this.shipped(), this.overrides()).filter(r => r.overridden).length);
  protected readonly changes = computed(() => this.plan()?.changes ?? []);

  protected readonly previewColumns: ColumnDef[] = [
    { field: 'key', header: this.translate.instant('admin.languages.key'), sortable: true },
    { field: 'currentValue', header: this.translate.instant('admin.languages.currentValue') },
    { field: 'newValue', header: this.translate.instant('admin.languages.newValue') },
  ];

  constructor() {
    this.languageControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    this.load();
  }

  private load(): void {
    const language = this.languageControl.value;
    this.loading.set(true);
    this.clearImport();
    this.shipped.set({});
    this.overrides.set({});
    this.transfer.load(language).subscribe({
      next: ({ shipped, overrides }) => {
        if (language !== this.languageControl.value) return;
        this.shipped.set(shipped);
        this.overrides.set(overrides);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        if (language !== this.languageControl.value) return;
        this.loading.set(false);
        this.snackbar.errorFrom(err, 'admin.languages.loadFailed');
      },
    });
  }

  protected exportCsv(): void {
    const rows = buildExportRows(this.shipped(), this.overrides());
    downloadCsv(exportCsvRows(rows, ['key', 'value', 'shipped', 'overridden']), `forge-${this.languageControl.value}-labels`);
  }

  protected exportJson(): void {
    const rows = buildExportRows(this.shipped(), this.overrides());
    const nested = nestCatalog(Object.fromEntries(rows.map(r => [r.key, r.value])));
    downloadBlob(
      new Blob([JSON.stringify(nested, null, 2)], { type: 'application/json;charset=utf-8;' }),
      `forge-${this.languageControl.value}-labels.json`);
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    file.text().then(text => this.preview(text, file.name));
  }

  protected preview(text: string, name: string): void {
    this.fileName.set(name);
    const imported = parseTranslationFile(text, name);
    this.unreadable.set(imported === null);
    this.plan.set(imported === null ? null : planImport(imported, this.shipped(), this.overrides()));
  }

  protected clearImport(): void {
    this.fileName.set(null);
    this.plan.set(null);
    this.unreadable.set(false);
  }

  protected applyImport(): void {
    const changes = this.changes();
    if (changes.length === 0 || this.busy() || this.keyCount() === 0) return;
    this.busy.set(true);
    this.transfer.import(this.languageControl.value, changes).subscribe({
      next: result => {
        this.busy.set(false);
        this.snackbar.success(this.translate.instant('admin.languages.imported', result));
        this.overridesService.refresh();
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'admin.languages.importFailed');
      },
    });
  }
}
