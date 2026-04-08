import { ChangeDetectionStrategy, Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';
import { AiAssistant } from '../../models/ai-assistant.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';

export interface AiAssistantDialogData {
  assistant: AiAssistant | null;
}

@Component({
  selector: 'app-ai-assistant-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent,
    TextareaComponent, ToggleComponent, ValidationPopoverDirective, MatTooltipModule,
  ],
  templateUrl: './ai-assistant-dialog.component.html',
  styleUrl: './ai-assistant-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly adminService = inject(AdminService);
  private readonly matDialogRef = inject(MatDialogRef<AiAssistantDialogComponent>);
  private readonly data: AiAssistantDialogData = inject(MAT_DIALOG_DATA);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly isEdit = signal(false);
  protected readonly showAdvanced = signal(false);
  protected readonly starterQuestions = signal<string[]>([]);

  readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    description: new FormControl('', [Validators.maxLength(500)]),
    category: new FormControl('Custom', [Validators.required]),
    icon: new FormControl('smart_toy', [Validators.required, Validators.maxLength(50)]),
    color: new FormControl('#0d9488', [Validators.required]),
    systemPrompt: new FormControl('', [Validators.required, Validators.maxLength(50000)]),
    allowedEntityTypes: new FormControl<string[]>([], { nonNullable: true }),
    isActive: new FormControl(true),
    sortOrder: new FormControl(0, [Validators.required, Validators.min(0)]),
    temperature: new FormControl(0.7, [Validators.required, Validators.min(0), Validators.max(1)]),
    maxContextChunks: new FormControl(5, [Validators.required, Validators.min(1), Validators.max(20)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name', description: 'Description', category: 'Category',
    icon: 'Icon', color: 'Color', systemPrompt: 'System Prompt',
    sortOrder: 'Sort Order', temperature: 'Temperature', maxContextChunks: 'Max Context Chunks',
  });

  protected readonly categoryOptions: SelectOption[] = [
    { value: 'General', label: this.translate.instant('aiAssistants.categoryGeneral') },
    { value: 'HR', label: this.translate.instant('aiAssistants.categoryHR') },
    { value: 'Procurement', label: this.translate.instant('aiAssistants.categoryProcurement') },
    { value: 'Sales', label: this.translate.instant('aiAssistants.categorySales') },
    { value: 'Custom', label: this.translate.instant('aiAssistants.categoryCustom') },
  ];

  protected readonly entityTypeOptions: SelectOption[] = [
    { value: 'Job', label: this.translate.instant('aiAssistants.entityJob') },
    { value: 'Part', label: this.translate.instant('aiAssistants.entityPart') },
    { value: 'Customer', label: this.translate.instant('aiAssistants.entityCustomer') },
    { value: 'Vendor', label: this.translate.instant('aiAssistants.entityVendor') },
    { value: 'Lead', label: this.translate.instant('aiAssistants.entityLead') },
    { value: 'Quote', label: this.translate.instant('aiAssistants.entityQuote') },
    { value: 'SalesOrder', label: this.translate.instant('aiAssistants.entitySalesOrder') },
    { value: 'PurchaseOrder', label: this.translate.instant('aiAssistants.entityPurchaseOrder') },
    { value: 'Invoice', label: this.translate.instant('aiAssistants.entityInvoice') },
    { value: 'Expense', label: this.translate.instant('aiAssistants.entityExpense') },
    { value: 'Asset', label: this.translate.instant('aiAssistants.entityAsset') },
    { value: 'EmployeeProfile', label: this.translate.instant('aiAssistants.entityEmployeeProfile') },
    { value: 'TimeEntry', label: this.translate.instant('aiAssistants.entityTimeEntry') },
    { value: 'ClockEvent', label: this.translate.instant('aiAssistants.entityClockEvent') },
    { value: 'FileAttachment', label: this.translate.instant('aiAssistants.entityFileAttachment') },
    { value: 'BOMEntry', label: this.translate.instant('aiAssistants.entityBOMEntry') },
    { value: 'StorageLocation', label: this.translate.instant('aiAssistants.entityStorageLocation') },
    { value: 'BinContent', label: this.translate.instant('aiAssistants.entityBinContent') },
    { value: 'PriceList', label: this.translate.instant('aiAssistants.entityPriceList') },
    { value: 'Shipment', label: this.translate.instant('aiAssistants.entityShipment') },
  ];

  protected readonly newQuestion = new FormControl('');

  protected readonly draftConfig: DraftConfig = {
    entityType: 'ai-assistant',
    entityId: this.data.assistant?.id?.toString() ?? 'new',
    route: '/admin/ai-assistants',
  };

  ngOnInit(): void {
    const assistant = this.data.assistant;
    if (assistant) {
      this.isEdit.set(true);
      this.form.patchValue({
        name: assistant.name,
        description: assistant.description,
        category: assistant.category,
        icon: assistant.icon,
        color: assistant.color,
        systemPrompt: assistant.systemPrompt,
        allowedEntityTypes: assistant.allowedEntityTypes,
        isActive: assistant.isActive,
        sortOrder: assistant.sortOrder,
        temperature: assistant.temperature,
        maxContextChunks: assistant.maxContextChunks,
      });
      this.starterQuestions.set([...assistant.starterQuestions]);
    }
  }

  protected toggleAdvanced(): void {
    this.showAdvanced.update(v => !v);
  }

  protected addQuestion(): void {
    const q = this.newQuestion.value?.trim();
    if (!q) return;
    this.starterQuestions.update(qs => [...qs, q]);
    this.newQuestion.reset();
  }

  protected removeQuestion(index: number): void {
    this.starterQuestions.update(qs => qs.filter((_, i) => i !== index));
  }

  protected close(): void {
    this.matDialogRef.close(false);
  }

  protected save(): void {
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const payload: Partial<AiAssistant> = {
      name: v.name!,
      description: v.description ?? '',
      category: v.category!,
      icon: v.icon!,
      color: v.color!,
      systemPrompt: v.systemPrompt!,
      allowedEntityTypes: v.allowedEntityTypes,
      starterQuestions: this.starterQuestions(),
      isActive: v.isActive!,
      sortOrder: v.sortOrder!,
      temperature: v.temperature!,
      maxContextChunks: v.maxContextChunks!,
    };

    this.saving.set(true);
    const request$ = this.isEdit()
      ? this.adminService.updateAiAssistant(this.data.assistant!.id, payload)
      : this.adminService.createAiAssistant(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.isEdit() ? this.translate.instant('aiAssistants.assistantUpdated') : this.translate.instant('aiAssistants.assistantCreated'));
        this.matDialogRef.close(true);
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.isEdit() ? this.translate.instant('aiAssistants.assistantUpdateFailed') : this.translate.instant('aiAssistants.assistantCreateFailed'));
      },
    });
  }
}
