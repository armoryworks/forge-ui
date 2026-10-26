import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CreditMemoService } from '../../services/credit-memo.service';
import { CreditMemoDetail } from '../../models/credit-memo-detail.model';
import { CustomerRefundRequest } from '../../models/customer-refund-request.model';
import { creditMemoStatusChip } from '../../credit-memo-status';
import { CustomerRefundDialogComponent } from '../customer-refund-dialog/customer-refund-dialog.component';
import { ApplyCreditMemoDialogComponent } from '../apply-credit-memo-dialog/apply-credit-memo-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DetailLoadErrorComponent } from '../../../../shared/components/detail-load-error/detail-load-error.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { downloadBlob } from '../../../../shared/utils/download-blob';

type VoidTarget = { kind: 'memo' } | { kind: 'refund'; refundId: number; refundNumber: string };

@Component({
  selector: 'app-credit-memo-detail-panel',
  standalone: true,
  imports: [
    DecimalPipe, RouterLink, ReactiveFormsModule, MatTooltipModule, TranslatePipe, DateOnlyPipe,
    DialogComponent, TextareaComponent, ValidationButtonComponent, EntityActivitySectionComponent, EntityLinkComponent,
    CurrencyDisplayComponent, DetailLoadErrorComponent, LoadingBlockDirective,
    CustomerRefundDialogComponent, ApplyCreditMemoDialogComponent,
  ],
  templateUrl: './credit-memo-detail-panel.component.html',
  styleUrl: './credit-memo-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditMemoDetailPanelComponent {
  private readonly service = inject(CreditMemoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  readonly creditMemoId = input.required<number>();
  readonly closed = output<void>();
  readonly updated = output<void>();

  protected readonly memo = signal<CreditMemoDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly busy = signal(false);
  protected readonly downloadingPdf = signal(false);
  protected readonly showRefund = signal(false);
  protected readonly showApply = signal(false);
  protected readonly voidTarget = signal<VoidTarget | null>(null);

  private readonly isFinance = computed(() => this.auth.hasAnyRole(['Admin', 'Manager', 'OfficeManager']));
  private readonly isApprover = computed(() => this.auth.hasAnyRole(['Admin', 'Manager']));
  protected readonly isController = computed(() => this.auth.hasRole('Controller'));

  protected readonly isOpen = computed(() => {
    const status = this.memo()?.status;
    return status === 'Issued' || status === 'PartiallyApplied';
  });
  protected readonly canIssue = computed(() => this.isFinance() && this.memo()?.status === 'Draft');
  protected readonly canDelete = computed(() => this.isFinance() && this.memo()?.status === 'Draft');
  protected readonly canApplyOrRefund = computed(() => this.isFinance() && this.isOpen() && (this.memo()?.openAmount ?? 0) > 0);
  protected readonly canVoid = computed(() => {
    const m = this.memo();
    return this.isApprover() && !!m && m.status !== 'Draft' && m.status !== 'Voided'
      && m.amountApplied === 0 && m.amountRefunded === 0;
  });
  protected readonly canUnapply = computed(() => this.isFinance());
  protected readonly canVoidRefund = computed(() => this.isApprover());
  protected readonly liveApplications = computed(() => (this.memo()?.applications ?? []).filter(a => !a.reversedAt));

  protected readonly voidForm = new FormGroup({
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
  });
  protected readonly voidViolations = FormValidationService.getViolations(this.voidForm, {
    reason: this.translate.instant('creditMemos.voidReason'),
  });

  constructor() {
    effect(() => {
      const id = this.creditMemoId();
      if (id) this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getById(id).subscribe({
      next: memo => {
        this.memo.set(memo);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(err);
      },
    });
  }

  private changed(memo: CreditMemoDetail, messageKey: string): void {
    this.memo.set(memo);
    this.busy.set(false);
    this.snackbar.success(this.translate.instant(messageKey, { number: memo.creditMemoNumber }));
    this.updated.emit();
  }

  protected statusClass(status: string): string {
    return creditMemoStatusChip(status);
  }

  protected issue(): void {
    const m = this.memo();
    if (!m || this.busy()) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('creditMemos.issueTitle'),
        message: this.translate.instant(m.invoiceId ? 'creditMemos.issueMessageInvoice' : 'creditMemos.issueMessage',
          { number: m.creditMemoNumber, invoice: m.invoiceNumber ?? '' }),
        confirmLabel: this.translate.instant('creditMemos.issue'),
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.busy.set(true);
      this.service.issue(m.id).subscribe({
        next: memo => this.changed(memo, 'creditMemos.issued'),
        error: () => this.busy.set(false),
      });
    });
  }

  protected deleteDraft(): void {
    const m = this.memo();
    if (!m || this.busy()) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('creditMemos.deleteTitle'),
        message: this.translate.instant('creditMemos.deleteMessage', { number: m.creditMemoNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.busy.set(true);
      this.service.delete(m.id, m.rowVersion).subscribe({
        next: () => {
          this.busy.set(false);
          this.snackbar.success(this.translate.instant('creditMemos.deleted', { number: m.creditMemoNumber }));
          this.updated.emit();
          this.closed.emit();
        },
        error: () => this.busy.set(false),
      });
    });
  }

  protected unapply(applicationId: number, invoiceNumber: string | null): void {
    const m = this.memo();
    if (!m || this.busy()) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('creditMemos.unapplyTitle'),
        message: this.translate.instant('creditMemos.unapplyMessage', { number: m.creditMemoNumber, invoice: invoiceNumber ?? '' }),
        confirmLabel: this.translate.instant('creditMemos.unapply'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.busy.set(true);
      this.service.unapply(m.id, applicationId).subscribe({
        next: memo => this.changed(memo, 'creditMemos.unapplied'),
        error: () => this.busy.set(false),
      });
    });
  }

  protected onApplied(memo: CreditMemoDetail): void {
    this.showApply.set(false);
    this.changed(memo, 'creditMemos.applied');
  }

  protected submitRefund(request: CustomerRefundRequest): void {
    const m = this.memo();
    if (!m) return;
    this.busy.set(true);
    this.service.refund(m.id, request).subscribe({
      next: memo => {
        this.showRefund.set(false);
        this.changed(memo, 'creditMemos.refunded');
      },
      error: () => this.busy.set(false),
    });
  }

  protected openVoid(target: VoidTarget): void {
    this.voidForm.reset();
    this.voidTarget.set(target);
  }

  protected confirmVoid(): void {
    const m = this.memo();
    const target = this.voidTarget();
    if (!m || !target || this.voidForm.invalid) return;
    const reason = this.voidForm.getRawValue().reason.trim();
    this.busy.set(true);
    if (target.kind === 'memo') {
      this.service.void(m.id, reason).subscribe({
        next: memo => {
          this.voidTarget.set(null);
          this.changed(memo, 'creditMemos.voided');
        },
        error: () => this.busy.set(false),
      });
      return;
    }
    this.service.voidRefund(target.refundId, reason).subscribe({
      next: () => {
        this.voidTarget.set(null);
        this.busy.set(false);
        this.snackbar.success(this.translate.instant('creditMemos.refundVoided', { number: target.refundNumber }));
        this.updated.emit();
        this.load(m.id);
      },
      error: () => this.busy.set(false),
    });
  }

  protected downloadPdf(): void {
    const m = this.memo();
    if (!m || this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.service.getPdf(m.id).subscribe({
      next: blob => {
        this.downloadingPdf.set(false);
        downloadBlob(blob, `${m.creditMemoNumber}.pdf`);
      },
      error: () => this.downloadingPdf.set(false),
    });
  }
}
