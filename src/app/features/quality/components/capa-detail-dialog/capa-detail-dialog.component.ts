import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap } from 'rxjs';

import { NcrCapaService } from '../../services/ncr-capa.service';
import { CorrectiveAction } from '../../models/corrective-action.model';
import { CapaTask } from '../../models/capa-task.model';
import { CapaTaskStatus } from '../../models/capa-task-status.model';
import { RootCauseMethod } from '../../models/root-cause-method.model';
import { QUALITY_MANAGER_ROLES } from '../../quality-roles';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-capa-detail-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateOnlyPipe,
    DialogComponent, SelectComponent, InputComponent, TextareaComponent, DatepickerComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './capa-detail-dialog.component.html',
  styleUrl: './capa-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapaDetailDialogComponent implements OnInit {
  private readonly service = inject(NcrCapaService);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly capaId = input.required<number>();
  readonly userOptions = input<SelectOption[]>([]);
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly canManage = computed(() => this.auth.hasAnyRole(QUALITY_MANAGER_ROLES));
  protected readonly capa = signal<CorrectiveAction | null>(null);
  protected readonly tasks = signal<CapaTask[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showTaskForm = signal(false);
  private taskStatusControls = new Map<number, FormControl<CapaTaskStatus>>();

  protected readonly rootCauseMethodOptions: SelectOption[] = (
    ['FiveWhy', 'Fishbone', 'FaultTree', 'EightD', 'Pareto', 'IsIsNot'] as RootCauseMethod[]
  ).map(m => ({ value: m, label: this.translate.instant(`capas.method.${m}`) }));

  protected readonly effectiveOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('capas.notDecided') },
    { value: true, label: this.translate.instant('common.yes') },
    { value: false, label: this.translate.instant('common.no') },
  ];

  protected readonly taskStatusOptions: SelectOption[] = (
    ['Open', 'InProgress', 'Completed', 'Cancelled'] as CapaTaskStatus[]
  ).map(s => ({ value: s, label: this.translate.instant(`capas.taskStatus.${s}`) }));

  protected readonly form = new FormGroup({
    rootCauseMethod: new FormControl<RootCauseMethod | null>(null),
    rootCauseAnalysis: new FormControl(''),
    containmentAction: new FormControl(''),
    correctiveActionDescription: new FormControl(''),
    preventiveAction: new FormControl(''),
    verificationMethod: new FormControl(''),
    verificationResult: new FormControl(''),
    effectivenessResult: new FormControl(''),
    isEffective: new FormControl<boolean | null>(null),
    ownerId: new FormControl<number | null>(null),
  });

  protected readonly taskForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    assigneeId: new FormControl<number | null>(null, [Validators.required]),
    dueDate: new FormControl<Date | null>(null, [Validators.required]),
  });

  ngOnInit(): void {
    if (!this.canManage()) this.form.disable({ emitEvent: false });
    this.load();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    this.saving.set(true);
    this.saveForm().subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('capas.saved'));
        this.changed.emit();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected advance(): void {
    this.saving.set(true);
    this.saveForm().pipe(
      switchMap(() => this.service.advanceCapaPhase(this.capaId())),
    ).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('capas.advanced', { status: updated.status }));
        this.changed.emit();
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.load();
      },
    });
  }

  protected openTaskForm(): void {
    this.taskForm.reset({ title: '', assigneeId: null, dueDate: null });
    this.showTaskForm.set(true);
  }

  protected addTask(): void {
    if (this.taskForm.invalid) return;
    const f = this.taskForm.getRawValue();
    this.saving.set(true);
    this.service.createCapaTask(this.capaId(), {
      title: f.title.trim(),
      assigneeId: f.assigneeId!,
      dueDate: toIsoDate(f.dueDate)!,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showTaskForm.set(false);
        this.changed.emit();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected taskStatusControl(task: CapaTask): FormControl<CapaTaskStatus> {
    let control = this.taskStatusControls.get(task.id);
    if (!control) {
      control = new FormControl<CapaTaskStatus>(task.status, { nonNullable: true });
      this.taskStatusControls.set(task.id, control);
    }
    return control;
  }

  protected setTaskStatus(task: CapaTask, status: unknown): void {
    if (status === task.status) return;
    this.service.updateCapaTask(this.capaId(), task.id, { status: status as CapaTaskStatus }).subscribe({
      next: () => {
        this.changed.emit();
        this.load();
      },
    });
  }

  private saveForm(): Observable<void> {
    if (!this.canManage() || !this.form.dirty) return of(undefined);
    const f = this.form.getRawValue();
    return this.service.updateCapa(this.capaId(), {
      rootCauseMethod: f.rootCauseMethod,
      rootCauseAnalysis: f.rootCauseAnalysis ?? '',
      containmentAction: f.containmentAction ?? '',
      correctiveActionDescription: f.correctiveActionDescription ?? '',
      preventiveAction: f.preventiveAction ?? '',
      verificationMethod: f.verificationMethod ?? '',
      verificationResult: f.verificationResult ?? '',
      effectivenessResult: f.effectivenessResult ?? '',
      isEffective: f.isEffective,
      ...(f.ownerId != null ? { ownerId: f.ownerId } : {}),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.service.getCapa(this.capaId()).subscribe({
      next: (capa) => {
        this.capa.set(capa);
        this.form.reset({
          rootCauseMethod: capa.rootCauseMethod,
          rootCauseAnalysis: capa.rootCauseAnalysis ?? '',
          containmentAction: capa.containmentAction ?? '',
          correctiveActionDescription: capa.correctiveActionDescription ?? '',
          preventiveAction: capa.preventiveAction ?? '',
          verificationMethod: capa.verificationMethod ?? '',
          verificationResult: capa.verificationResult ?? '',
          effectivenessResult: capa.effectivenessResult ?? '',
          isEffective: capa.isEffective,
          ownerId: capa.ownerId,
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.service.getCapaTasks(this.capaId()).subscribe({
      next: (tasks) => {
        this.taskStatusControls = new Map();
        this.tasks.set(tasks);
      },
    });
  }
}
