import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { SequencesService } from '../../services/sequences.service';
import { SequenceDefinition, SequenceInstance, SequenceInstanceStatus } from '../../models/sequence.model';
import { SequenceInstancePanelComponent } from '../../components/instance-detail-panel/instance-detail-panel.component';

/** Running/finished sequence instances: filter, start a new run, and operate the selected one. */
@Component({
  selector: 'app-sequence-instances-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent, SequenceInstancePanelComponent],
  templateUrl: './sequence-instances-page.component.html',
  styleUrl: './sequence-instances-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SequenceInstancesPageComponent {
  private readonly service = inject(SequencesService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly instances = signal<SequenceInstance[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly showStart = signal(false);
  protected readonly starting = signal(false);
  protected readonly publishedDefs = signal<SequenceDefinition[]>([]);

  protected readonly statusFilter = new FormControl<SequenceInstanceStatus | ''>('Running', { nonNullable: true });
  protected readonly startDefId = new FormControl<number | null>(null);
  protected readonly startSubjectType = new FormControl<string>('', { nonNullable: true });
  protected readonly startSubjectId = new FormControl<number | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('sequences.filter.all') },
    { value: 'Running', label: 'Running' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  protected readonly defOptions = signal<SelectOption[]>([]);

  constructor() {
    this.reload();
    this.service.getDefinitions(undefined, 'Published').subscribe({
      next: (defs) => {
        this.publishedDefs.set(defs);
        this.defOptions.set([
          { value: null, label: this.translate.instant('sequences.start.pickDefinition') },
          ...defs.map(d => ({ value: d.id, label: `${d.name} (v${d.version})` })),
        ]);
      },
    });
    this.statusFilter.valueChanges.subscribe(() => this.reload());
  }

  protected reload(): void {
    this.loading.set(true);
    const status = this.statusFilter.value || undefined;
    this.service.getInstances({ status: status as SequenceInstanceStatus | undefined }).subscribe({
      next: (list) => {
        this.instances.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected select(inst: SequenceInstance): void {
    this.selectedId.set(inst.id);
  }

  protected onChanged(): void {
    this.reload();
  }

  protected start(): void {
    const defId = this.startDefId.value;
    if (!defId || this.starting()) return;
    this.starting.set(true);
    const subjectType = this.startSubjectType.value.trim() || null;
    const subjectId = this.startSubjectId.value;
    this.service.start({
      definitionId: defId,
      subjectEntityType: subjectType,
      subjectEntityId: subjectType ? subjectId : null,
    }).subscribe({
      next: (inst) => {
        this.snackbar.success(this.translate.instant('sequences.start.started'));
        this.starting.set(false);
        this.showStart.set(false);
        this.startDefId.reset();
        this.startSubjectType.reset();
        this.startSubjectId.reset();
        this.reload();
        this.selectedId.set(inst.id);
      },
      error: (err) => {
        this.snackbar.error(err?.error?.detail ?? this.translate.instant('sequences.start.failed'));
        this.starting.set(false);
      },
    });
  }

  protected statusChipClass(status: string): string {
    return { Running: 'chip--info', Completed: 'chip--success', Cancelled: 'chip--danger' }[status] ?? 'chip--muted';
  }
}
