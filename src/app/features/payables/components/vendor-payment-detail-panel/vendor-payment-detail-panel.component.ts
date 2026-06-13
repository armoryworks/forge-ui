import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorPaymentService } from '../../services/vendor-payment.service';
import { PaymentTransmissionService } from '../../services/payment-transmission.service';
import { VendorPaymentDetail } from '../../models/vendor-payment-detail.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityActivitySectionComponent, ActivityFilterTab } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

// ⚡ ACCOUNTING BOUNDARY — AP counterpart of PaymentDetailPanel.
@Component({
  selector: 'app-vendor-payment-detail-panel',
  standalone: true,
  imports: [
    DatePipe, TranslatePipe, ReactiveFormsModule,
    MatTooltipModule, LoadingBlockDirective,
    DialogComponent, TextareaComponent, ValidationButtonComponent,
    EntityActivitySectionComponent, EntityLinkComponent, CurrencyDisplayComponent,
  ],
  templateUrl: './vendor-payment-detail-panel.component.html',
  styleUrl: './vendor-payment-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPaymentDetailPanelComponent {
  private readonly paymentService = inject(VendorPaymentService);
  private readonly transmissionService = inject(PaymentTransmissionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly paymentId = input.required<number>();
  readonly closed = output<void>();
  readonly paymentChanged = output<void>();

  protected readonly loading = signal(false);
  protected readonly payment = signal<VendorPaymentDetail | null>(null);
  /** History-only, mirroring the AR sibling (PaymentDetailPanel). */
  protected readonly activityTabs: ActivityFilterTab[] = ['history'];

  /** Show the settlement FX column only when any application settled at a rate ≠ 1. */
  protected readonly showFxColumn = computed(() =>
    (this.payment()?.applications ?? []).some(a => a.settlementFxRate !== 1),
  );

  // --- Void (mirrors the PO short-close reason dialog; AR delete-style action placement) ---
  // Hidden once the bank transmission Succeeded — money already moved, the server 409s.
  protected readonly canVoid = computed(() => {
    const payment = this.payment();
    return !!payment && payment.transmissionStatus !== 'Succeeded';
  });

  protected readonly showVoidDialog = signal(false);
  protected readonly voidSaving = signal(false);
  protected readonly voidForm = new FormGroup({
    reason: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(2000)],
    }),
  });
  protected readonly voidViolations = FormValidationService.getViolations(this.voidForm, {
    reason: this.translate.instant('payables.voidReason'),
  });

  constructor() {
    effect(() => {
      const id = this.paymentId();
      if (id) {
        this.loadPayment(id);
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected getMethodLabel(method: string): string {
    const key = 'payables.method' + method;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : method;
  }

  protected getTransmissionChipClass(status: string): string {
    const map: Record<string, string> = {
      Queued: 'chip--info',
      Retrying: 'chip--warning',
      Succeeded: 'chip--success',
      Failed: 'chip--error',
      Cancelled: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getTransmissionStatusLabel(status: string): string {
    const key = 'payables.transmission.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected attestWire(): void {
    const payment = this.payment();
    if (!payment) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('payables.wire.attestTitle'),
        message: this.translate.instant('payables.wire.attestMessage', { number: payment.paymentNumber }),
        confirmLabel: this.translate.instant('payables.wire.attest'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      // SoD (attester must differ from the creator) is enforced server-side; a 409 surfaces
      // via the global error toast.
      this.paymentService.attestWire(payment.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('payables.wire.attested'));
          this.loadPayment(payment.id);
          this.paymentChanged.emit();
        },
      });
    });
  }

  protected retryTransmission(): void {
    const payment = this.payment();
    if (!payment || payment.transmissionId === null) return;
    const transmissionId = payment.transmissionId;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('payables.transmission.retryTitle'),
        message: this.translate.instant('payables.transmission.retryMessage', { number: payment.paymentNumber }),
        confirmLabel: this.translate.instant('payables.transmission.retry'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      // 409 (not Failed/Cancelled — e.g. retried elsewhere) surfaces via the
      // global error interceptor toast — only reload on success.
      this.transmissionService.retryPaymentTransmission(transmissionId).subscribe({
        next: () => {
          this.loadPayment(payment.id);
          this.snackbar.success(this.translate.instant('payables.transmission.retryQueued'));
        },
      });
    });
  }

  protected openVoidDialog(): void {
    this.voidForm.reset();
    this.showVoidDialog.set(true);
  }

  protected confirmVoid(): void {
    const payment = this.payment();
    if (!payment || this.voidForm.invalid) return;
    const reason = this.voidForm.getRawValue().reason.trim();
    this.voidSaving.set(true);
    // 409 (transmission already Succeeded / already voided) surfaces via the
    // global error interceptor toast — only close + reload on success.
    this.paymentService.voidVendorPayment(payment.id, reason).subscribe({
      next: () => {
        this.voidSaving.set(false);
        this.showVoidDialog.set(false);
        this.snackbar.success(this.translate.instant('payables.paymentVoided'));
        this.paymentChanged.emit();
        this.closed.emit();
      },
      error: () => this.voidSaving.set(false),
    });
  }

  private loadPayment(id: number): void {
    this.loading.set(true);
    this.paymentService.getVendorPaymentById(id).subscribe({
      next: (detail) => {
        this.payment.set(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
