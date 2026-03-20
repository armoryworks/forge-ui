import { ChangeDetectionStrategy, Component, inject, input, signal, effect } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AdminService } from '../../services/admin.service';
import { UserComplianceDetail, ComplianceFormSubmission, IdentityDocument } from '../../../account/models/compliance-form.model';
import { PayrollService } from '../../../account/services/payroll.service';
import { PayStub, TaxDocument } from '../../../account/models/payroll.model';

@Component({
  selector: 'app-user-compliance-panel',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, TranslatePipe, LoadingBlockDirective, EmptyStateComponent, FileUploadZoneComponent, ConfirmDialogComponent, MatTooltipModule],
  templateUrl: './user-compliance-panel.component.html',
  styleUrl: './user-compliance-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCompliancePanelComponent {
  private readonly adminService = inject(AdminService);
  private readonly payrollService = inject(PayrollService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  readonly userId = input<number | null>(null);
  protected readonly detail = signal<UserComplianceDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly sending = signal(false);

  // Payroll
  protected readonly payStubs = signal<PayStub[]>([]);
  protected readonly taxDocuments = signal<TaxDocument[]>([]);
  protected readonly payrollLoading = signal(false);

  // Upload state — last uploaded file ID for linking to payroll record
  protected readonly lastPayStubFileId = signal<number | null>(null);
  protected readonly lastTaxDocFileId = signal<number | null>(null);

  constructor() {
    effect(() => {
      const id = this.userId();
      if (id) {
        this.loadDetail(id);
        this.loadPayroll(id);
      } else {
        this.detail.set(null);
        this.payStubs.set([]);
        this.taxDocuments.set([]);
      }
    });
  }

  private loadDetail(userId: number): void {
    this.loading.set(true);
    this.adminService.getUserComplianceDetail(userId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadPayroll(userId: number): void {
    this.payrollLoading.set(true);
    this.payrollService.getUserPayStubs(userId).subscribe({
      next: (stubs) => {
        this.payStubs.set(stubs);
        this.payrollLoading.set(false);
      },
      error: () => this.payrollLoading.set(false),
    });
    this.payrollService.getUserTaxDocuments(userId).subscribe({
      next: (docs) => this.taxDocuments.set(docs),
    });
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Completed': return 'chip chip--success';
      case 'Pending': return 'chip chip--warning';
      case 'Opened': return 'chip chip--info';
      case 'Expired': return 'chip chip--error';
      case 'Declined': return 'chip chip--error';
      default: return 'chip chip--muted';
    }
  }

  protected verifyDocument(doc: IdentityDocument): void {
    this.adminService.verifyIdentityDocument(doc.id).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('admin.documentVerified'));
        const id = this.userId();
        if (id) this.loadDetail(id);
      },
    });
  }

  protected sendReminder(): void {
    const id = this.userId();
    if (!id) return;
    this.sending.set(true);
    this.adminService.sendComplianceReminder(id).subscribe({
      next: () => {
        this.sending.set(false);
        this.snackbar.success(this.translate.instant('admin.reminderSent'));
      },
      error: () => this.sending.set(false),
    });
  }

  protected downloadSignedPdf(sub: ComplianceFormSubmission): void {
    if (!sub.signedPdfFileId) return;
    window.open(`/api/v1/files/${sub.signedPdfFileId}`, '_blank');
  }

  // ── Payroll ──

  protected downloadPayStubPdf(id: number): void {
    this.payrollService.downloadPayStubPdf(id);
  }

  protected downloadTaxDocumentPdf(id: number): void {
    this.payrollService.downloadTaxDocumentPdf(id);
  }

  protected onPayStubFileUploaded(event: UploadedFile): void {
    this.lastPayStubFileId.set(+event.id);
    this.snackbar.success(this.translate.instant('admin.fileUploadedPayStub'));
  }

  protected onTaxDocFileUploaded(event: UploadedFile): void {
    this.lastTaxDocFileId.set(+event.id);
    this.snackbar.success(this.translate.instant('admin.fileUploadedTaxDoc'));
  }

  protected savePayStub(payDate: string, periodStart: string, periodEnd: string, grossPay: string, netPay: string): void {
    const id = this.userId();
    const fileId = this.lastPayStubFileId();
    if (!id || !fileId || !payDate || !periodStart || !periodEnd || !grossPay || !netPay) {
      this.snackbar.error(this.translate.instant('admin.uploadAndFillFields'));
      return;
    }
    this.payrollService.uploadPayStub(id, {
      payDate: new Date(payDate).toISOString(),
      payPeriodStart: new Date(periodStart).toISOString(),
      payPeriodEnd: new Date(periodEnd).toISOString(),
      grossPay: parseFloat(grossPay),
      netPay: parseFloat(netPay),
      fileAttachmentId: fileId,
    }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('admin.payStubUploaded'));
        this.lastPayStubFileId.set(null);
        this.loadPayroll(id);
      },
    });
  }

  protected saveTaxDocument(documentType: string, taxYear: string): void {
    const id = this.userId();
    const fileId = this.lastTaxDocFileId();
    if (!id || !fileId || !documentType || !taxYear) {
      this.snackbar.error(this.translate.instant('admin.uploadAndFillFields'));
      return;
    }
    this.payrollService.uploadTaxDocument(id, {
      documentType,
      taxYear: parseInt(taxYear, 10),
      fileAttachmentId: fileId,
    }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('admin.taxDocUploaded'));
        this.lastTaxDocFileId.set(null);
        this.loadPayroll(id);
      },
    });
  }

  protected deletePayStub(stub: PayStub): void {
    if (stub.source !== 'Manual') return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Pay Stub?',
        message: `This will remove the manually uploaded pay stub for ${new Date(stub.payDate).toLocaleDateString()}.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.payrollService.deletePayStub(stub.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.payStubDeleted'));
          const id = this.userId();
          if (id) this.loadPayroll(id);
        },
      });
    });
  }

  protected deleteTaxDocument(doc: TaxDocument): void {
    if (doc.source !== 'Manual') return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Tax Document?',
        message: `This will remove the manually uploaded ${doc.documentType} for ${doc.taxYear}.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.payrollService.deleteTaxDocument(doc.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.taxDocDeleted'));
          const id = this.userId();
          if (id) this.loadPayroll(id);
        },
      });
    });
  }

  protected getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      W2: 'W-2',
      W2c: 'W-2c (Corrected)',
      Misc1099: '1099-MISC',
      Nec1099: '1099-NEC',
      Other: 'Other',
    };
    return labels[type] ?? type;
  }
}
