import {
  ChangeDetectionStrategy, Component, computed, inject,
  input, OnInit, output, signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { KanbanService } from '../services/kanban.service';
import { JobDetail } from '../models/job-detail.model';
import { CustomerRef } from '../models/customer-ref.model';
import { UserRef } from '../models/user-ref.model';
import { TrackType } from '../../../shared/models/track-type.model';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../shared/directives/validation-popover.directive';
import { toIsoDate } from '../../../shared/utils/date.utils';
import { PRIORITIES, PRIORITY_OPTIONS } from '../../../shared/models/priority.const';

export type DialogMode = 'create' | 'edit';

@Component({
  selector: 'app-job-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    DatepickerComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './job-dialog.component.html',
  styleUrl: './job-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDialogComponent implements OnInit {
  private readonly kanbanService = inject(KanbanService);

  readonly mode = input.required<DialogMode>();
  readonly job = input<JobDetail | null>(null);
  readonly trackTypes = input.required<TrackType[]>();

  readonly saved = output<JobDetail>();
  readonly cancelled = output<void>();

  protected readonly customers = signal<CustomerRef[]>([]);
  protected readonly users = signal<UserRef[]>([]);
  protected readonly saving = signal(false);
  protected readonly loadingRefs = signal(true);
  protected readonly priorities = PRIORITIES;

  protected readonly jobForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    description: new FormControl(''),
    trackTypeId: new FormControl<number>(0, [Validators.required]),
    customerId: new FormControl<number | null>(null),
    assigneeId: new FormControl<number | null>(null),
    priority: new FormControl('Normal'),
    dueDate: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.jobForm, {
    title: 'Title',
    trackTypeId: 'Track Type',
  });

  protected readonly trackTypeOptions = computed<SelectOption[]>(() =>
    this.trackTypes().map(tt => ({ value: tt.id, label: tt.name }))
  );

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: '— None —' },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly assigneeOptions = computed<SelectOption[]>(() => [
    { value: null, label: '— Unassigned —' },
    ...this.users().map(u => ({
      value: u.id,
      label: u.canBeAssignedJobs ? u.name : `⚠ ${u.name} (incomplete profile)`,
    })),
  ]);

  protected readonly priorityOptions = PRIORITY_OPTIONS;

  ngOnInit(): void {
    const j = this.job();
    if (j) {
      this.jobForm.patchValue({
        title: j.title,
        description: j.description ?? '',
        trackTypeId: j.trackTypeId,
        customerId: j.customerId,
        assigneeId: j.assigneeId,
        priority: j.priority,
        dueDate: j.dueDate ? new Date(j.dueDate) : null,
      });
    } else {
      const types = this.trackTypes();
      const defaultType = types.find(t => t.isDefault) ?? types[0];
      if (defaultType) {
        this.jobForm.patchValue({ trackTypeId: defaultType.id });
      }
    }

    forkJoin({
      customers: this.kanbanService.getCustomers(),
      users: this.kanbanService.getUsers(),
    }).subscribe(({ customers, users }) => {
      this.customers.set(customers);
      this.users.set(users);
      this.loadingRefs.set(false);
    });
  }

  protected onSubmit(): void {
    if (this.jobForm.invalid) return;

    this.saving.set(true);

    const f = this.jobForm.getRawValue();
    const dueDate = toIsoDate(f.dueDate);

    if (this.mode() === 'create') {
      this.kanbanService.createJob({
        title: f.title!.trim(),
        description: f.description || undefined,
        trackTypeId: f.trackTypeId!,
        assigneeId: f.assigneeId,
        customerId: f.customerId,
        priority: f.priority ?? 'Normal',
        dueDate,
      }).subscribe({
        next: (detail) => {
          this.saving.set(false);
          this.saved.emit(detail);
        },
        error: () => this.saving.set(false),
      });
    } else {
      const jobId = this.job()!.id;
      this.kanbanService.updateJob(jobId, {
        title: f.title!.trim(),
        description: f.description || null,
        assigneeId: f.assigneeId,
        customerId: f.customerId,
        priority: f.priority ?? 'Normal',
        dueDate,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          const updated: JobDetail = {
            ...this.job()!,
            title: f.title!.trim(),
            description: f.description || null,
            assigneeId: f.assigneeId,
            customerId: f.customerId,
            priority: f.priority ?? 'Normal',
            dueDate,
          };
          this.saved.emit(updated);
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
