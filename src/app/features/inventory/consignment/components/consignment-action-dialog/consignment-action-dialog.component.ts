import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConsignmentService } from '../../services/consignment.service';
import { ConsignmentAction } from '../../models/consignment-action.type';
import { ConsignmentAgreementStock } from '../../models/consignment-agreement-stock.model';
import { ConsignmentReconciliation } from '../../models/consignment-reconciliation.model';
import { InventoryService } from '../../../services/inventory.service';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { EntityPickerComponent } from '../../../../../shared/components/entity-picker/entity-picker.component';
import { EntityLinkComponent } from '../../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../../shared/utils/date.utils';

/**
 * Receive vendor-owned stock into a bin, consume it (taking ownership, optionally issuing it to a job), or reconcile
 * a period: an optional count of what is on consignment and a draft vendor bill for what was used.
 */
@Component({
  selector: 'app-consignment-action-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, ToggleComponent, EntityPickerComponent,
    EntityLinkComponent, CurrencyDisplayComponent, ValidationButtonComponent,
  ],
  templateUrl: './consignment-action-dialog.component.html',
  styleUrl: './consignment-action-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsignmentActionDialogComponent implements OnInit {
  private readonly service = inject(ConsignmentService);
  private readonly inventory = inject(InventoryService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly action = input.required<ConsignmentAction>();
  readonly stock = input.required<ConsignmentAgreementStock>();
  readonly closed = output<void>();
  readonly done = output<void>();

  protected readonly saving = signal(false);
  protected readonly locationOptions = signal<SelectOption[]>([]);
  protected readonly result = signal<ConsignmentReconciliation | null>(null);
  protected readonly titleKey = computed(() => `consignment.actions.${this.action()}`);

  protected readonly form = new FormGroup({
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    storageLocationId: new FormControl<number | null>(null),
    lotNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    jobId: new FormControl<number | null>(null),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly reconcileForm = new FormGroup({
    physicalCount: new FormControl<number | null>(null, [Validators.min(0)]),
    periodFrom: new FormControl<Date | null>(null),
    periodTo: new FormControl<Date | null>(null),
    createBill: new FormControl<boolean>(true, { nonNullable: true }),
    vendorInvoiceNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    quantity: this.translate.instant('common.quantity'),
  });

  protected readonly reconcileViolations = FormValidationService.getViolations(this.reconcileForm, {
    physicalCount: this.translate.instant('consignment.physicalCount'),
    vendorInvoiceNumber: this.translate.instant('consignment.vendorInvoiceNumber'),
  });

  ngOnInit(): void {
    if (this.action() === 'reconcile') return;
    this.inventory.getAllActiveBinLocations().subscribe({
      next: locations => this.locationOptions.set([
        { value: null, label: this.translate.instant(this.action() === 'receive' ? 'consignment.defaultLocation' : 'consignment.anyLocation') },
        ...locations.map(l => ({ value: l.id, label: l.locationPath || l.name })),
      ]),
      error: () => this.locationOptions.set([]),
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    const id = this.stock().agreementId;
    if (this.action() === 'reconcile') {
      if (this.reconcileForm.invalid) return;
      const r = this.reconcileForm.getRawValue();
      this.saving.set(true);
      this.service.reconcile(id, {
        physicalCount: r.physicalCount,
        periodFrom: toDateOnly(r.periodFrom),
        periodTo: toDateOnly(r.periodTo),
        createBill: r.createBill,
        vendorInvoiceNumber: r.vendorInvoiceNumber.trim() || null,
      }).subscribe({
        next: result => {
          this.saving.set(false);
          this.result.set(result);
          this.done.emit();
        },
        error: () => this.saving.set(false),
      });
      return;
    }

    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    const request = {
      quantity: f.quantity ?? 0,
      notes: f.notes.trim() || null,
      storageLocationId: f.storageLocationId,
      binContentId: null,
      lotNumber: this.action() === 'receive' ? f.lotNumber.trim() || null : null,
      jobId: this.action() === 'consume' ? f.jobId : null,
      purchaseOrderId: null,
    };
    const request$ = this.action() === 'receive' ? this.service.receive(id, request) : this.service.consume(id, request);
    this.saving.set(true);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(`consignment.${this.action()}Done`, { part: this.stock().partNumber }));
        this.done.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
