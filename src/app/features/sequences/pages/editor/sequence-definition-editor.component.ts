import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SequencesService } from '../../services/sequences.service';
import {
  SequenceDefinitionRequest, SequenceEdgeDefinition, SequenceExpiryAction,
  SequenceGateDefinition, SequenceGateSourceType, SequenceJoinPolicy, SequenceStepDefinition,
} from '../../models/sequence.model';

/** Authoring editor for a Draft sequence definition — the whole graph (steps + edges + gates) in one form. */
@Component({
  selector: 'app-sequence-definition-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, InputComponent, SelectComponent, TextareaComponent],
  templateUrl: './sequence-definition-editor.component.html',
  styleUrl: './sequence-definition-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SequenceDefinitionEditorComponent {
  private readonly service = inject(SequencesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly editingId = signal<number | null>(null);
  protected readonly saving = signal(false);

  protected readonly joinPolicyOptions: SelectOption[] = [
    { value: 'All', label: 'All' }, { value: 'Any', label: 'Any' },
  ];
  protected readonly expiryOptions: SelectOption[] = [
    { value: 'Block', label: 'Block' }, { value: 'Flag', label: 'Flag' }, { value: 'Escalate', label: 'Escalate' },
  ];
  protected readonly sourceTypeOptions: SelectOption[] = [
    { value: 'ManualClearance', label: 'Manual clearance' },
    { value: 'TimeWindow', label: 'Time window' },
    { value: 'ResourceClock', label: 'Resource clock' },
    { value: 'Approval', label: 'Approval' },
    { value: 'Custom', label: 'Custom' },
  ];

  /** Per-source-type example config, shown as a hint under the config field. */
  private readonly configHints: Record<SequenceGateSourceType, string> = {
    ManualClearance: '{ "requiredRole": "Inspector" }',
    TimeWindow: '{ "notBefore": "2026-01-01T00:00:00Z", "notAfter": null }',
    ResourceClock: '{ "resourceType": "Lot", "resourceId": 42 }  — or { "fromSubject": true }',
    Approval: '{ "entityType": "PurchaseOrder", "entityId": 7 }  — or { "fromSubject": true }',
    Custom: '{ "key": "job-stage", "stageCode": "in-production" }',
  };

  protected readonly form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    subjectEntityType: new FormControl('', { nonNullable: true }),
    autoStartOnSubjectCreate: new FormControl(false, { nonNullable: true }),
    steps: new FormArray<FormGroup>([]),
    edges: new FormArray<FormGroup>([]),
    gates: new FormArray<FormGroup>([]),
  });

  protected readonly autoStartOptions: SelectOption[] = [
    { value: false, label: this.translate.instant('common.no') },
    { value: true, label: this.translate.instant('common.yes') },
  ];

  // Step keys that gate/edge selects choose from — recomputed as steps change.
  protected readonly stepKeyOptions = signal<SelectOption[]>([]);

  get steps(): FormArray<FormGroup> { return this.form.controls.steps; }
  get edges(): FormArray<FormGroup> { return this.form.controls.edges; }
  get gates(): FormArray<FormGroup> { return this.form.controls.gates; }

  protected readonly title = computed(() =>
    this.editingId() ? this.translate.instant('sequences.editor.editTitle') : this.translate.instant('sequences.editor.newTitle'));

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.editingId.set(id);
      this.service.getDefinition(id).subscribe({ next: (def) => this.hydrate(def) });
    } else {
      this.addStep();
    }
    this.steps.valueChanges.subscribe(() => this.refreshStepKeys());
  }

  private refreshStepKeys(): void {
    const opts = this.steps.controls
      .map(g => String(g.controls['key'].value ?? '').trim())
      .filter(k => k.length > 0)
      .map(k => ({ value: k, label: k }));
    this.stepKeyOptions.set(opts);
  }

  private stepGroup(s?: Partial<SequenceStepDefinition>): FormGroup {
    return new FormGroup({
      key: new FormControl(s?.key ?? '', { nonNullable: true, validators: [Validators.required] }),
      name: new FormControl(s?.name ?? '', { nonNullable: true, validators: [Validators.required] }),
      description: new FormControl(s?.description ?? '', { nonNullable: true }),
      sortOrder: new FormControl(s?.sortOrder ?? this.steps.length + 1, { nonNullable: true }),
      joinPolicy: new FormControl<SequenceJoinPolicy>(s?.joinPolicy ?? 'All', { nonNullable: true }),
      maxDwellMinutes: new FormControl<number | null>(s?.maxDwellMinutes ?? null),
      dwellExpiryAction: new FormControl<SequenceExpiryAction>(s?.dwellExpiryAction ?? 'Flag', { nonNullable: true }),
      escalateRole: new FormControl(s?.escalateRole ?? '', { nonNullable: true }),
    });
  }

  private edgeGroup(e?: Partial<SequenceEdgeDefinition>): FormGroup {
    return new FormGroup({
      fromStepKey: new FormControl(e?.fromStepKey ?? '', { nonNullable: true, validators: [Validators.required] }),
      toStepKey: new FormControl(e?.toStepKey ?? '', { nonNullable: true, validators: [Validators.required] }),
      isRework: new FormControl(e?.isRework ?? false, { nonNullable: true }),
    });
  }

  private gateGroup(g?: Partial<SequenceGateDefinition>): FormGroup {
    return new FormGroup({
      stepKey: new FormControl(g?.stepKey ?? '', { nonNullable: true, validators: [Validators.required] }),
      key: new FormControl(g?.key ?? '', { nonNullable: true, validators: [Validators.required] }),
      name: new FormControl(g?.name ?? '', { nonNullable: true, validators: [Validators.required] }),
      sourceType: new FormControl<SequenceGateSourceType>(g?.sourceType ?? 'ManualClearance', { nonNullable: true }),
      configJson: new FormControl(g?.configJson ?? '{}', { nonNullable: true }),
      expiryAction: new FormControl<SequenceExpiryAction>(g?.expiryAction ?? 'Block', { nonNullable: true }),
      escalateRole: new FormControl(g?.escalateRole ?? '', { nonNullable: true }),
    });
  }

  protected addStep(): void { this.steps.push(this.stepGroup()); }
  protected removeStep(i: number): void { this.steps.removeAt(i); this.refreshStepKeys(); }
  protected addEdge(): void { this.edges.push(this.edgeGroup()); }
  protected removeEdge(i: number): void { this.edges.removeAt(i); }
  protected addGate(): void { this.gates.push(this.gateGroup()); }
  protected removeGate(i: number): void { this.gates.removeAt(i); }

  protected configHint(gate: FormGroup): string {
    return this.configHints[gate.controls['sourceType'].value as SequenceGateSourceType] ?? '{}';
  }

  private hydrate(def: SequenceDefinitionRequest & { id?: number }): void {
    this.form.patchValue({
      code: def.code, name: def.name, description: def.description ?? '',
      subjectEntityType: def.subjectEntityType ?? '', autoStartOnSubjectCreate: def.autoStartOnSubjectCreate,
    });
    this.steps.clear(); this.edges.clear(); this.gates.clear();
    (def.steps ?? []).forEach(s => this.steps.push(this.stepGroup(s)));
    (def.edges ?? []).forEach(e => this.edges.push(this.edgeGroup(e)));
    (def.gates ?? []).forEach(g => this.gates.push(this.gateGroup(g)));
    if (this.steps.length === 0) this.addStep();
    this.refreshStepKeys();
  }

  protected save(): void {
    if (this.form.invalid || this.steps.length === 0 || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    // Validate gate config is JSON.
    for (const g of this.gates.controls) {
      try { JSON.parse(g.controls['configJson'].value || '{}'); }
      catch {
        this.snackbar.error(this.translate.instant('sequences.editor.badConfig', { gate: g.controls['key'].value }));
        return;
      }
    }
    const v = this.form.getRawValue();
    const model: SequenceDefinitionRequest = {
      code: v.code.trim(),
      name: v.name.trim(),
      description: v.description.trim() || null,
      subjectEntityType: v.subjectEntityType.trim() || null,
      autoStartOnSubjectCreate: v.autoStartOnSubjectCreate,
      steps: this.steps.getRawValue().map(s => ({
        ...s, escalateRole: (s['escalateRole'] as string)?.trim() || null,
      })) as SequenceStepDefinition[],
      edges: this.edges.getRawValue() as SequenceEdgeDefinition[],
      gates: this.gates.getRawValue().map(g => ({
        ...g, escalateRole: (g['escalateRole'] as string)?.trim() || null,
      })) as SequenceGateDefinition[],
    };

    this.saving.set(true);
    const id = this.editingId();
    const op = id ? this.service.updateDefinition(id, model) : this.service.createDefinition(model);
    op.subscribe({
      next: (def) => {
        this.snackbar.success(this.translate.instant('sequences.editor.saved'));
        this.saving.set(false);
        this.router.navigate(['/sequences'], { queryParams: { selected: def.id } });
      },
      error: (err) => {
        this.snackbar.error(err?.error?.detail ?? this.translate.instant('sequences.editor.saveFailed'));
        this.saving.set(false);
      },
    });
  }
}
