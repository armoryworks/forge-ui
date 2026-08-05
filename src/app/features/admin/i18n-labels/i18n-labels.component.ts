import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime, map } from 'rxjs';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LanguageService } from '../../../shared/services/language.service';
import { I18nOverridesService } from '../../../shared/services/i18n-overrides.service';
import { I18nLabelService } from '../services/i18n-label.service';
import { I18nLabelOverride } from '../models/i18n-label-override.model';

/** One editor row — a shipped catalog key joined with its override (if any) for the selected language. */
interface I18nLabelRow {
  key: string;
  baseValue: string;
  overrideValue: string | null;
  overrideId: number | null;
  isMachineTranslated: boolean;
  isPendingTranslation: boolean;
  searchText: string;
}

/**
 * Admin editor for tenant i18n label overrides (CAP-ADMIN-I18N).
 *
 * Lists every key of the shipped catalog for the selected language with its
 * base value vs. customized override; editing writes a DB override that the
 * I18nOverridesService merges over the catalog at load time, and fans out
 * machine translations to the other configured languages (flagged, editable,
 * pending when the AI module is unreachable). Language + search live in the
 * URL (?lang=…&q=…).
 */
@Component({
  selector: 'app-i18n-labels',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './i18n-labels.component.html',
  styleUrl: './i18n-labels.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class I18nLabelsComponent {
  private readonly service = inject(I18nLabelService);
  private readonly overridesService = inject(I18nOverridesService);
  private readonly languageService = inject(LanguageService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // URL is the source of truth for the language + search filters.
  protected readonly selectedLang = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('lang') ?? 'en')),
    { initialValue: 'en' },
  );
  protected readonly search = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('q') ?? '')),
    { initialValue: '' },
  );

  protected readonly langControl = new FormControl<string>('en', { nonNullable: true });
  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });

  protected readonly languageOptions: SelectOption[] = this.languageService.availableLanguages
    .map((l) => ({ value: l.code, label: l.label }));

  protected readonly overrides = signal<I18nLabelOverride[]>([]);
  /** language code → flattened shipped catalog (dotted key → text). */
  private readonly catalogs = signal<Record<string, Record<string, string>>>({});
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly retrying = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingRow = signal<I18nLabelRow | null>(null);

  protected readonly pendingCount = computed(
    () => this.overrides().filter((o) => o.isPendingTranslation).length,
  );

  private readonly rows = computed<I18nLabelRow[]>(() => {
    const lang = this.selectedLang();
    const base = this.catalogs()[lang] ?? {};
    const byKey = new Map<string, I18nLabelOverride>();
    for (const o of this.overrides()) {
      if (o.languageCode === lang) {
        byKey.set(o.key, o);
      }
    }

    const rows: I18nLabelRow[] = [];
    for (const [key, baseValue] of Object.entries(base)) {
      const override = byKey.get(key);
      byKey.delete(key);
      rows.push(this.toRow(key, baseValue, override));
    }
    // Overrides whose key no longer exists in the shipped catalog (orphans) stay visible for revert.
    for (const override of byKey.values()) {
      rows.push(this.toRow(override.key, '', override));
    }
    return rows;
  });

  protected readonly filteredRows = computed<I18nLabelRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    const rows = this.rows();
    return term ? rows.filter((r) => r.searchText.includes(term)) : rows;
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'key', header: 'Key', sortable: true, width: '280px' },
    { field: 'baseValue', header: 'Base Value', sortable: true },
    { field: 'overrideValue', header: 'Override', sortable: true },
    { field: 'status', header: 'Status', width: '120px', align: 'center' },
    { field: 'actions', header: '', width: '90px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    value: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    autoTranslate: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    value: this.translate.instant('admin.i18nLabels.fieldValue'),
  });

  constructor() {
    // Hydrate controls from the URL once, then push control edits back to the URL.
    this.langControl.setValue(this.selectedLang(), { emitEvent: false });
    this.searchControl.setValue(this.search(), { emitEvent: false });

    this.langControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lang) => this.patchUrl({ lang }));
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.patchUrl({ q: q.trim() || null }));

    // Browser back/forward: reflect the URL back into the controls.
    effect(() => {
      const lang = this.selectedLang();
      if (this.langControl.value !== lang) {
        this.langControl.setValue(lang, { emitEvent: false });
      }
    });

    // Lazily fetch the shipped catalog for whichever language is selected.
    effect(() => {
      const lang = this.selectedLang();
      if (!this.catalogs()[lang]) {
        this.loadCatalog(lang);
      }
    });

    this.loadOverrides();
  }

  protected loadOverrides(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.overrides.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadCatalog(lang: string): void {
    this.service.baseCatalog(lang).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (catalog) => {
        const flat: Record<string, string> = {};
        this.flatten(catalog, '', flat);
        this.catalogs.update((all) => ({ ...all, [lang]: flat }));
      },
      error: () => this.catalogs.update((all) => ({ ...all, [lang]: {} })),
    });
  }

  protected openEdit(row: I18nLabelRow): void {
    this.editingRow.set(row);
    this.form.reset({ value: row.overrideValue ?? row.baseValue, autoTranslate: true });
    this.showDialog.set(true);
  }

  protected close(): void {
    this.showDialog.set(false);
    this.editingRow.set(null);
  }

  protected save(): void {
    const row = this.editingRow();
    if (!row || this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    this.service.upsert({
      key: row.key,
      languageCode: this.selectedLang(),
      value: f.value.trim(),
      translateToOtherLanguages: f.autoTranslate,
    }).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(
          result.translationsPending ? 'admin.i18nLabels.savedPending' : 'admin.i18nLabels.saved'));
        this.close();
        this.loadOverrides();
        this.overridesService.refresh();
      },
      error: () => this.saving.set(false),
    });
  }

  protected confirmRevert(row: I18nLabelRow): void {
    if (row.overrideId === null) return;
    const overrideId = row.overrideId;
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('admin.i18nLabels.revertTitle'),
        message: this.translate.instant('admin.i18nLabels.revertMessage', { key: row.key }),
        confirmLabel: this.translate.instant('admin.i18nLabels.revert'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.revert(overrideId).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.i18nLabels.reverted'));
          this.loadOverrides();
          this.overridesService.refresh();
        },
      });
    });
  }

  protected retryPending(): void {
    this.retrying.set(true);
    this.service.retryPending().subscribe({
      next: (result) => {
        this.retrying.set(false);
        this.snackbar.success(this.translate.instant('admin.i18nLabels.retryDone', {
          translated: result.translatedCount,
          pending: result.stillPendingCount,
        }));
        this.loadOverrides();
        this.overridesService.refresh();
      },
      error: () => this.retrying.set(false),
    });
  }

  private toRow(key: string, baseValue: string, override: I18nLabelOverride | undefined): I18nLabelRow {
    return {
      key,
      baseValue,
      overrideValue: override?.value ?? null,
      overrideId: override?.id ?? null,
      isMachineTranslated: override?.isMachineTranslated ?? false,
      isPendingTranslation: override?.isPendingTranslation ?? false,
      searchText: `${key}\n${baseValue}\n${override?.value ?? ''}`.toLowerCase(),
    };
  }

  private flatten(node: Record<string, unknown>, prefix: string, out: Record<string, string>): void {
    for (const [k, v] of Object.entries(node)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        out[key] = v;
      } else if (v !== null && typeof v === 'object') {
        this.flatten(v as Record<string, unknown>, key, out);
      }
    }
  }

  private patchUrl(params: Record<string, string | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
