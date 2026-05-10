import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AssignmentRuleService } from '../services/assignment-rule.service';
import { AssignmentRule, AssignmentRuleKind } from '../models/assignment-rule.model';
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

/**
 * Phase 1r / Batch 11 — admin CRUD for lead-assignment rules.
 *
 * Spec is exposed as a raw JSON textarea today — Kind-specific form
 * shapes (territory zips, rep ids, industry codes) are a follow-on
 * once the matching engine ships and we know the exact shape per kind.
 * Until then this surface lets admins enter the JSON directly so the
 * matching logic can be developed against real rule rows.
 */
@Component({
  selector: 'app-assignment-rules',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './assignment-rules.component.html',
  styleUrl: './assignment-rules.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentRulesComponent {
  private readonly service = inject(AssignmentRuleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rules = signal<AssignmentRule[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly kindOptions: SelectOption[] = [
    { value: 'RoundRobin', label: this.translate.instant('admin.assignmentRules.kind.RoundRobin') },
    { value: 'Territory', label: this.translate.instant('admin.assignmentRules.kind.Territory') },
    { value: 'Industry', label: this.translate.instant('admin.assignmentRules.kind.Industry') },
    { value: 'AccountBased', label: this.translate.instant('admin.assignmentRules.kind.AccountBased') },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'priority', header: this.translate.instant('admin.assignmentRules.colPriority'), sortable: true, type: 'number', align: 'right', width: '90px' },
    { field: 'name', header: this.translate.instant('admin.assignmentRules.colName'), sortable: true },
    { field: 'kind', header: this.translate.instant('admin.assignmentRules.colKind'), sortable: true, width: '150px' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '90px', align: 'center' },
    { field: 'createdAt', header: this.translate.instant('admin.assignmentRules.colCreated'), sortable: true, type: 'date', width: '110px' },
    { field: 'actions', header: '', width: '110px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    kind: new FormControl<AssignmentRuleKind>('RoundRobin', { nonNullable: true, validators: [Validators.required] }),
    priority: new FormControl<number>(100, { nonNullable: true, validators: [Validators.required] }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
    // Structured fields — each kind reads its own subset; on save we
    // serialize the relevant fields to JSON into `spec`. Storing
    // structured + raw side-by-side lets the admin fall back to raw
    // when a Kind acquires fields the form doesn't surface yet.
    specRepIds: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    specStates: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    specZipPrefixes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    specIndustries: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    specRaw: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });

  /** Reactive Kind so the template can show/hide kind-specific sub-forms. */
  protected readonly currentKind = toSignal(
    this.form.controls.kind.valueChanges.pipe(startWith(this.form.controls.kind.value)),
    { initialValue: this.form.controls.kind.value },
  );

  protected readonly showRoundRobinFields = computed(() => this.currentKind() === 'RoundRobin');
  protected readonly showTerritoryFields = computed(() => this.currentKind() === 'Territory');
  protected readonly showIndustryFields = computed(() => this.currentKind() === 'Industry');
  protected readonly showAccountBasedHint = computed(() => this.currentKind() === 'AccountBased');

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('admin.assignmentRules.fieldName'),
    kind: this.translate.instant('admin.assignmentRules.fieldKind'),
    priority: this.translate.instant('admin.assignmentRules.fieldPriority'),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.rules.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openNew(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '', kind: 'RoundRobin', priority: 100, isActive: true,
      specRepIds: '', specStates: '', specZipPrefixes: '', specIndustries: '', specRaw: '',
    });
    this.showDialog.set(true);
  }

  protected openEdit(row: AssignmentRule): void {
    this.editingId.set(row.id);
    const parsed = this.parseSpec(row.spec, row.kind);
    this.form.reset({
      name: row.name,
      kind: row.kind,
      priority: row.priority,
      isActive: row.isActive,
      specRepIds: parsed.repIds,
      specStates: parsed.states,
      specZipPrefixes: parsed.zipPrefixes,
      specIndustries: parsed.industries,
      specRaw: parsed.raw,
    });
    this.showDialog.set(true);
  }

  /**
   * Parse the stored JSON spec into the structured form fields. When the
   * JSON doesn't match the expected Kind shape (admin hand-edited it, or
   * Kind changed), we fall through to the raw textarea so nothing is lost.
   */
  private parseSpec(spec: string | null, kind: AssignmentRuleKind): {
    repIds: string; states: string; zipPrefixes: string; industries: string; raw: string;
  } {
    const empty = { repIds: '', states: '', zipPrefixes: '', industries: '', raw: '' };
    if (!spec) return empty;
    try {
      const obj = JSON.parse(spec) as Record<string, unknown>;
      if (kind === 'RoundRobin' && Array.isArray(obj['repIds'])) {
        return { ...empty, repIds: (obj['repIds'] as number[]).join(', ') };
      }
      if (kind === 'Territory') {
        const states = Array.isArray(obj['states']) ? (obj['states'] as string[]).join(', ') : '';
        const zips = Array.isArray(obj['zipPrefixes']) ? (obj['zipPrefixes'] as string[]).join(', ') : '';
        if (states || zips) return { ...empty, states, zipPrefixes: zips };
      }
      if (kind === 'Industry' && Array.isArray(obj['industries'])) {
        return { ...empty, industries: (obj['industries'] as string[]).join(', ') };
      }
    } catch {
      // Fall through to raw display.
    }
    return { ...empty, raw: spec };
  }

  /**
   * Serialize the structured form fields back to a JSON spec string. The
   * raw field wins when the structured fields are empty (lets admins
   * paste a hand-crafted spec for kinds the form doesn't surface).
   */
  private buildSpec(kind: AssignmentRuleKind, form: {
    specRepIds: string; specStates: string; specZipPrefixes: string;
    specIndustries: string; specRaw: string;
  }): string | null {
    if (kind === 'RoundRobin') {
      const ids = this.parseIntList(form.specRepIds);
      if (ids.length > 0) return JSON.stringify({ repIds: ids });
    }
    if (kind === 'Territory') {
      const states = this.parseStringList(form.specStates).map(s => s.toUpperCase());
      const zips = this.parseStringList(form.specZipPrefixes);
      if (states.length > 0 || zips.length > 0) {
        const payload: Record<string, string[]> = {};
        if (states.length > 0) payload['states'] = states;
        if (zips.length > 0) payload['zipPrefixes'] = zips;
        return JSON.stringify(payload);
      }
    }
    if (kind === 'Industry') {
      const industries = this.parseStringList(form.specIndustries);
      if (industries.length > 0) return JSON.stringify({ industries });
    }
    if (kind === 'AccountBased') return null;
    // Fallback to raw JSON when structured fields are empty.
    return form.specRaw.trim() || null;
  }

  private parseIntList(input: string): number[] {
    return input.split(/[,\s]+/).map(s => s.trim()).filter(s => s).map(s => Number(s)).filter(n => Number.isFinite(n) && n > 0);
  }

  private parseStringList(input: string): string[] {
    return input.split(/[,\s]+/).map(s => s.trim()).filter(s => s);
  }

  protected close(): void {
    this.showDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const id = this.editingId();
    const spec = this.buildSpec(f.kind, f);

    if (id !== null) {
      this.service.update(id, {
        name: f.name.trim(),
        kind: f.kind,
        priority: f.priority,
        isActive: f.isActive,
        spec,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success(this.translate.instant('admin.assignmentRules.updated'));
          this.close();
          this.load();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.service.create({
        name: f.name.trim(),
        kind: f.kind,
        priority: f.priority,
        spec,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success(this.translate.instant('admin.assignmentRules.created'));
          this.close();
          this.load();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected confirmDelete(row: AssignmentRule): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('admin.assignmentRules.deleteTitle'),
        message: this.translate.instant('admin.assignmentRules.deleteMessage', { name: row.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.assignmentRules.deleted'));
          this.load();
        },
      });
    });
  }
}
