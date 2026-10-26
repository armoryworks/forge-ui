import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorCreditMemoDetail } from '../../models/vendor-credit-memo-detail.model';
import { vendorCreditStatusChip } from '../../vendor-credit-status';
import { PAYABLES_MANAGE_ROLES } from '../../payables-roles';
import { ApplyVendorCreditDialogComponent } from '../apply-vendor-credit-dialog/apply-vendor-credit-dialog.component';
import { VendorCreditMemoDialogComponent } from '../vendor-credit-memo-dialog/vendor-credit-memo-dialog.component';
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

@Component({
  selector: 'app-vendor-credit-memo-detail-panel',
  standalone: true,
  imports: [
    DecimalPipe, RouterLink, ReactiveFormsModule, MatTooltipModule, TranslatePipe, DateOnlyPipe,
    DialogComponent, TextareaComponent, ValidationButtonComponent, EntityActivitySectionComponent, EntityLinkComponent,
    CurrencyDisplayComponent, DetailLoadErrorComponent, LoadingBlockDirective,
    ApplyVendorCreditDialogComponent, VendorCreditMemoDialogComponent,
  ],
  templateUrl: './vendor-credit-memo-detail-panel.component.html',
  styleUrl: './vendor-credit-memo-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorCreditMemoDetailPanelComponent {
  private readonly service = inject(VendorCreditMemoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  readonly memoId = input.required<number>();
  readonly closed = output<void>();
  readonly updated = output<void>();

  protected readonly memo = signal<VendorCreditMemoDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly busy = signal(false);
  protected readonly downloadingPdf = signal(false);
  protected readonly showApply = signal(false);
  protected readonly showEdit = signal(false);
  protected readonly showVoid = signal(false);

  private readonly canManage = computed(() => this.auth.hasAnyRole(PAYABLES_MANAGE_ROLES));
  private readonly isApprover = computed(() => this.auth.hasAnyRole(['Admin', 'Manager']));
  protected readonly isController = computed(() => this.auth.hasRole('Controller'));

  protected readonly isDraft = computed(() => this.memo()?.status === 'Draft');
  protected readonly canEdit = computed(() => this.canManage() && this.isDraft());
  protected readonly canApply = computed(() => {
    const m = this.memo();
    return this.canManage() && !!m && (m.status === 'Open' || m.status === 'PartiallyApplied') && m.openAmount > 0;
  });
  protected readonly canUnapply = computed(() => this.canManage());
  protected readonly canVoid = computed(() => {
    const m = this.memo();
    return this.isApprover() && !!m && m.status !== 'Draft' && m.status !== 'Voided' && m.amountApplied === 0;
  });

  protected readonly voidForm = new FormGroup({
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
  });
  protected readonly voidViolations = FormValidationService.getViolations(this.voidForm, {
    reason: this.translate.instant('vendorCredits.voidReason'),
  });

  constructor() {
    effect(() => {
      const id = this.memoId();
      if (id) this.load(id);
    });
  }

  protected load(id: number): void {
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

  private changed(memo: VendorCreditMemoDetail, messageKey: string): void {
    this.memo.set(memo);
    this.busy.set(false);
    this.snackbar.success(this.translate.instant(messageKey, { number: memo.memoNumber }));
    this.updated.emit();
  }

  protected statusClass(status: string): string {
    return vendorCreditStatusChip(status);
  }

  protected issue(): void {
    const m = this.memo();
    if (!m || this.busy()) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('vendorCredits.issueTitle'),
        message: this.translate.instant(m.vendorBillId ? 'vendorCredits.issueMessageBill' : 'vendorCredits.issueMessage',
          { number: m.memoNumber, bill: m.vendorBillNumber ?? '' }),
        confirmLabel: this.translate.instant('vendorCredits.issue'),
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.busy.set(true);
      this.service.issue(m.id).subscribe({
        next: memo => this.changed(memo, 'vendorCredits.issued'),
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
        title: this.translate.instant('vendorCredits.deleteTitle'),
        message: this.translate.instant('vendorCredits.deleteMessage', { number: m.memoNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.busy.set(true);
      this.service.delete(m.id, m.rowVersion).subscribe({
        next: () => {
          this.busy.set(false);
          this.snackbar.success(this.translate.instant('vendorCredits.deleted', { number: m.memoNumber }));
          this.updated.emit();
          this.closed.emit();
        },
        error: () => this.busy.set(false),
      });
    });
  }

  protected unapply(applicationId: number, billNumber: string | null): void {
    const m = this.memo();
    if (!m || this.busy()) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('vendorCredits.unapplyTitle'),
        message: this.translate.instant('vendorCredits.unapplyMessage', { number: m.memoNumber, bill: billNumber ?? '' }),
        confirmLabel: this.translate.instant('vendorCredits.unapply'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.busy.set(true);
      this.service.unapply(m.id, applicationId).subscribe({
        next: memo => this.changed(memo, 'vendorCredits.unapplied'),
        error: () => this.busy.set(false),
      });
    });
  }

  protected onApplied(memo: VendorCreditMemoDetail): void {
    this.showApply.set(false);
    this.changed(memo, 'vendorCredits.appliedMessage');
  }

  protected onEdited(): void {
    this.showEdit.set(false);
    this.updated.emit();
    const m = this.memo();
    if (m) this.load(m.id);
  }

  protected openVoid(): void {
    this.voidForm.reset();
    this.showVoid.set(true);
  }

  protected confirmVoid(): void {
    const m = this.memo();
    if (!m || this.voidForm.invalid) return;
    this.busy.set(true);
    this.service.void(m.id, this.voidForm.getRawValue().reason.trim()).subscribe({
      next: memo => {
        this.showVoid.set(false);
        this.changed(memo, 'vendorCredits.voided');
      },
      error: () => this.busy.set(false),
    });
  }

  protected downloadPdf(): void {
    const m = this.memo();
    if (!m || this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.service.getPdf(m.id, this.translate.getCurrentLang?.() || 'en').subscribe({
      next: blob => {
        this.downloadingPdf.set(false);
        downloadBlob(blob, `${m.memoNumber}.pdf`);
      },
      error: () => this.downloadingPdf.set(false),
    });
  }
}
