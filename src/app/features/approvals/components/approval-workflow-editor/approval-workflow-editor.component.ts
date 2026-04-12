import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { ApprovalsService } from '../../services/approvals.service';
import { ApprovalWorkflow, ApproverType } from '../../models/approval.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';

@Component({
  selector: 'app-approval-workflow-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    DataTableComponent, ColumnCellDirective, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent,
    ValidationPopoverDirective, LoadingBlockDirective,
  ],
  templateUrl: './approval-workflow-editor.component.html',
  styleUrl: './approval-workflow-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalWorkflowEditorComponent implements OnInit {
  private readonly approvalsService = inject(ApprovalsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly workflows = signal<ApprovalWorkflow[]>([]);
  protected readonly showDialog = signal(false);
  protected readonly editingWorkflow = signal<ApprovalWorkflow | null>(null);

  protected readonly entityTypeOptions: SelectOption[] = [
    { value: 'PurchaseOrder', label: 'Purchase Order' },
    { value: 'Expense', label: 'Expense' },
    { value: 'Quote', label: 'Quote' },
    { value: 'TimeEntry', label: 'Time Entry' },
    { value: 'SalesOrder', label: 'Sales Order' },
  ];

  protected readonly approverTypeOptions: SelectOption[] = [
    { value: 'SpecificUser', label: 'Specific User' },
    { value: 'Role', label: 'Role' },
    { value: 'Manager', label: 'Direct Manager' },
  ];

  protected readonly roleOptions: SelectOption[] = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Manager', label: 'Manager' },
    { value: 'OfficeManager', label: 'Office Manager' },
    { value: 'PM', label: 'PM' },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'entityType', header: 'Entity Type', sortable: true, width: '150px' },
    { field: 'isActive', header: 'Active', sortable: true, align: 'center', width: '80px' },
    { field: 'stepsCount', header: 'Steps', align: 'center', width: '80px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '120px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  protected readonly workflowForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    entityType: new FormControl<string>('PurchaseOrder', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl(''),
    amountThreshold: new FormControl<number | null>(null),
    steps: new FormArray<FormGroup>([]),
  });

  protected readonly violations = FormValidationService.getViolations(this.workflowForm, {
    name: 'Name', entityType: 'Entity Type',
  });

  protected get stepsArray(): FormArray<FormGroup> {
    return this.workflowForm.controls.steps;
  }

  ngOnInit(): void {
    this.loadWorkflows();
  }

  protected openCreate(): void {
    this.editingWorkflow.set(null);
    this.workflowForm.reset({ entityType: 'PurchaseOrder' });
    this.stepsArray.clear();
    this.addStep();
    this.showDialog.set(true);
  }

  protected openEdit(workflow: ApprovalWorkflow): void {
    this.editingWorkflow.set(workflow);
    const conditions = workflow.activationConditionsJson
      ? JSON.parse(workflow.activationConditionsJson) : {};
    this.workflowForm.patchValue({
      name: workflow.name,
      entityType: workflow.entityType,
      description: workflow.description ?? '',
      amountThreshold: conditions.amountGreaterThan ?? null,
    });
    this.stepsArray.clear();
    for (const s of workflow.steps) {
      this.stepsArray.push(this.createStepGroup({ ...s }));
    }
    this.showDialog.set(true);
  }

  protected addStep(): void {
    this.stepsArray.push(this.createStepGroup({
      stepNumber: this.stepsArray.length + 1,
      name: this.stepsArray.length === 0 ? 'Manager Approval' : '',
      approverType: 'Role',
      approverUserId: null,
      approverRole: 'Manager',
      useDirectManager: false,
      autoApproveBelow: null,
      escalationHours: null,
      requireComments: false,
      allowDelegation: true,
    }));
  }

  protected removeStep(index: number): void {
    this.stepsArray.removeAt(index);
    for (let i = 0; i < this.stepsArray.length; i++) {
      this.stepsArray.at(i).patchValue({ stepNumber: i + 1 });
    }
  }

  protected save(): void {
    if (this.workflowForm.invalid || this.stepsArray.length === 0) return;
    this.saving.set(true);

    const data = this.workflowForm.getRawValue();
    const conditionsJson = data.amountThreshold
      ? JSON.stringify({ amountGreaterThan: data.amountThreshold })
      : undefined;

    const payload = {
      name: data.name, entityType: data.entityType,
      description: data.description || undefined,
      activationConditionsJson: conditionsJson,
      steps: data.steps.map((s: Record<string, unknown>) => ({
        stepNumber: s['stepNumber'],
        name: s['name'],
        approverType: s['approverType'],
        approverUserId: s['approverUserId'],
        approverRole: s['approverRole'],
        useDirectManager: s['useDirectManager'],
        autoApproveBelow: s['autoApproveBelow'],
        escalationHours: s['escalationHours'],
        requireComments: s['requireComments'],
        allowDelegation: s['allowDelegation'],
      })),
    };

    const editing = this.editingWorkflow();
    const obs = editing
      ? this.approvalsService.updateWorkflow(editing.id, payload)
      : this.approvalsService.createWorkflow(payload);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackbar.success(editing ? 'Workflow updated' : 'Workflow created');
        this.showDialog.set(false);
        this.saving.set(false);
        this.loadWorkflows();
      },
      error: () => this.saving.set(false),
    });
  }

  protected getWorkflowData(): { stepsCount: number }[] {
    return this.workflows().map(w => ({ ...w, stepsCount: w.steps.length }));
  }

  private createStepGroup(step: Record<string, unknown>): FormGroup {
    return new FormGroup({
      stepNumber: new FormControl(step['stepNumber']),
      name: new FormControl(step['name'], { validators: [Validators.required] }),
      approverType: new FormControl(step['approverType']),
      approverUserId: new FormControl(step['approverUserId']),
      approverRole: new FormControl(step['approverRole']),
      useDirectManager: new FormControl(step['useDirectManager']),
      autoApproveBelow: new FormControl(step['autoApproveBelow']),
      escalationHours: new FormControl(step['escalationHours']),
      requireComments: new FormControl(step['requireComments']),
      allowDelegation: new FormControl(step['allowDelegation']),
    });
  }

  private loadWorkflows(): void {
    this.loading.set(true);
    this.approvalsService.getWorkflows()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.workflows.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
