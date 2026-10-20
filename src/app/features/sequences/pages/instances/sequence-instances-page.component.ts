import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { SequencesService } from '../../services/sequences.service';
import { SequenceDefinition, SequenceInstance, SequenceInstanceStatus } from '../../models/sequence.model';
import { SequenceInstancePanelComponent } from '../../components/instance-detail-panel/instance-detail-panel.component';
import { EnumLabelPipe } from '../../../../shared/pipes/enum-label.pipe';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';

/** Running/finished sequence instances: filter, start a new run, and operate the selected one. */
@Component({
  selector: 'app-sequence-instances-page',
  standalone: true,
  imports: [
    EnumLabelPipe, DateTimePipe, ReactiveFormsModule, TranslatePipe, EntityPickerComponent, InputComponent, PageHeaderComponent, SelectComponent,
    SequenceInstancePanelComponent,
  ],
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
  protected readonly startSubjectId = new FormControl<number | null>(null);
  private readonly startDefIdValue = toSignal(this.startDefId.valueChanges, { initialValue: this.startDefId.value });
  private readonly startSubjectIdValue = toSignal(this.startSubjectId.valueChanges, { initialValue: this.startSubjectId.value });

  protected readonly subjectType = computed(() => {
    const def = this.publishedDefs().find(d => d.id === this.startDefIdValue());
    return def?.subjectEntityType?.trim() || null;
  });
  protected readonly isJobSubject = computed(() => this.subjectType()?.toLowerCase() === 'job');
  protected readonly canStart = computed(() =>
    !!this.startDefIdValue() && !this.starting() && (!this.subjectType() || this.startSubjectIdValue() != null));

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
        this.defOptions.set(defs.map(d => ({ value: d.id, label: `${d.name} (v${d.version})` })));
      },
    });
    this.statusFilter.valueChanges.subscribe(() => this.reload());
    this.startDefId.valueChanges.subscribe(() => this.startSubjectId.reset());
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
    if (!defId || !this.canStart()) return;
    this.starting.set(true);
    const subjectType = this.subjectType();
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
        this.startSubjectId.reset();
        this.reload();
        this.selectedId.set(inst.id);
      },
      error: (err) => {
        this.snackbar.errorFrom(err, 'sequences.start.failed');
        this.starting.set(false);
      },
    });
  }

  protected statusChipClass(status: string): string {
    return { Running: 'chip--info', Completed: 'chip--success', Cancelled: 'chip--danger' }[status] ?? 'chip--muted';
  }
}
