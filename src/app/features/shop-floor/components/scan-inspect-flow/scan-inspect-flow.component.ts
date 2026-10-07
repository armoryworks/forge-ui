import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { QcInspection } from '../../../quality/models/qc-inspection.model';
import { QcTemplateItem } from '../../../quality/models/qc-template-item.model';
import { QualityService } from '../../../quality/services/quality.service';

type InspectStep = 'inspect' | 'submitting' | 'done';

@Component({
  selector: 'app-scan-inspect-flow',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, TextareaComponent, ToggleComponent],
  templateUrl: './scan-inspect-flow.component.html',
  styleUrl: './scan-inspect-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanInspectFlowComponent implements OnInit {
  private readonly qualityService = inject(QualityService);
  private readonly destroyRef = inject(DestroyRef);

  // Inputs
  readonly partId = input.required<number>();
  readonly partNumber = input.required<string>();
  readonly qcTemplateId = input<number | null>(null);

  // Outputs
  readonly completed = output<void>();
  readonly cancelled = output<void>();

  // State
  protected readonly step = signal<InspectStep>('inspect');
  protected readonly result = signal<'Pass' | 'Fail' | null>(null);
  protected readonly notesControl = new FormControl('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly checklist = signal<QcTemplateItem[]>([]);
  protected readonly checklistLoading = signal(false);
  protected readonly checklistForm = new FormGroup<Record<string, FormControl<boolean>>>({});
  private readonly checkedItemIds = signal<ReadonlySet<number>>(new Set());
  private pendingInspection: QcInspection | null = null;

  protected readonly requiredItemsChecked = computed(() => {
    const checked = this.checkedItemIds();
    return this.checklist().every(item => !item.isRequired || checked.has(item.id));
  });
  protected readonly canPass = computed(() => !this.checklistLoading() && this.requiredItemsChecked());
  protected readonly canSubmit = computed(() => {
    const result = this.result();
    return result === 'Fail' || (result === 'Pass' && this.canPass());
  });

  ngOnInit(): void {
    this.checklistForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.checkedItemIds.set(this.readCheckedItemIds()));

    const templateId = this.qcTemplateId();
    if (!templateId) return;

    this.checklistLoading.set(true);
    this.qualityService.getTemplates().subscribe({
      next: (templates) => {
        const items = [...(templates.find(t => t.id === templateId)?.items ?? [])]
          .sort((a, b) => a.sortOrder - b.sortOrder);
        for (const item of items)
          this.checklistForm.addControl(String(item.id), new FormControl(false, { nonNullable: true }));
        this.checklist.set(items);
        this.checklistLoading.set(false);
      },
      error: () => this.checklistLoading.set(false),
    });
  }

  protected setResult(value: 'Pass' | 'Fail'): void {
    this.result.set(value);
  }

  protected submitInspection(): void {
    const inspectionResult = this.result();
    if (!inspectionResult || this.submitting() || !this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);
    this.step.set('submitting');

    if (this.pendingInspection) {
      this.completeInspection(this.pendingInspection, inspectionResult);
      return;
    }

    this.qualityService.createInspection({
      templateId: this.qcTemplateId() ?? undefined,
      notes: this.notesControl.value || undefined,
    }).subscribe({
      next: (inspection) => {
        this.pendingInspection = inspection;
        this.completeInspection(inspection, inspectionResult);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.submitting.set(false);
        this.step.set('inspect');
        this.error.set(err?.error?.detail ?? 'Failed to create inspection');
      },
    });
  }

  private completeInspection(inspection: QcInspection, inspectionResult: 'Pass' | 'Fail'): void {
    const checked = this.readCheckedItemIds();
    const checkedResults = inspectionResult === 'Pass' && inspection.results.length > 0
      ? inspection.results.map(r => ({
        id: r.id,
        checklistItemId: r.checklistItemId ?? undefined,
        description: r.description,
        passed: r.checklistItemId !== null && checked.has(r.checklistItemId),
        measuredValue: r.measuredValue ?? undefined,
        notes: r.notes ?? undefined,
      }))
      : undefined;

    this.qualityService.updateInspection(inspection.id, {
      status: inspectionResult === 'Pass' ? 'Passed' : 'Failed',
      notes: this.notesControl.value || undefined,
      results: checkedResults,
    }).subscribe({
      next: () => {
        this.pendingInspection = null;
        this.submitting.set(false);
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.submitting.set(false);
        this.step.set('inspect');
        this.error.set(err?.error?.detail ?? 'Failed to update inspection result');
      },
    });
  }

  private readCheckedItemIds(): Set<number> {
    return new Set(
      Object.entries(this.checklistForm.getRawValue())
        .filter(([, checked]) => checked)
        .map(([id]) => Number(id)),
    );
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
