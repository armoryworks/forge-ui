import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

import { CustomerTaxDocument } from '../../models/customer-tax-document.model';
import { CustomerTaxDocumentService } from '../../services/customer-tax-document.service';
import { CustomerTaxDocumentDialogComponent } from './customer-tax-document-dialog.component';
import { CustomerTaxDocumentRejectDialogComponent } from './customer-tax-document-reject-dialog.component';

/** Row view-model: pre-computed chip class / i18n keys (no template fn calls). */
interface TaxDocumentRow {
  doc: CustomerTaxDocument;
  statusKey: string;
  chipClass: string;
  typeKey: string;
  isExpired: boolean;
  canVerify: boolean;
  canReject: boolean;
}

/**
 * S1 — Tax Documents cluster: the customer's state tax certificates with
 * their verification workflow (Pending → Verified/Rejected, expiry-aware).
 * Mounted INSIDE the Documents tab, below the general documents cluster
 * (both are flex:1 columns, so the tab splits between them) — tax certs are
 * files first, and a separate tab for a rarely-touched list felt heavier
 * than co-locating them with the other customer documents.
 *
 * "Add tax document" = upload via the shared upload zone (entityType
 * "customers", same as general docs) then a metadata dialog that links the
 * new FileAttachment as a CustomerTaxDocument. Verify/Reject are Admin-only.
 */
@Component({
  selector: 'app-customer-tax-documents-cluster',
  standalone: true,
  imports: [
    DatePipe,
    MatTooltipModule,
    TranslatePipe,
    FileUploadZoneComponent,
    LoadingBlockDirective,
    CustomerTaxDocumentDialogComponent,
    CustomerTaxDocumentRejectDialogComponent,
  ],
  templateUrl: './customer-tax-documents-cluster.component.html',
  styleUrl: './customer-tax-documents-cluster.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerTaxDocumentsClusterComponent {
  private static readonly TYPE_KEYS: Record<string, string> = {
    Resale: 'customers.taxDocuments.typeResale',
    Exemption: 'customers.taxDocuments.typeExemption',
    DirectPay: 'customers.taxDocuments.typeDirectPay',
    Other: 'customers.taxDocuments.typeOther',
  };

  private readonly taxDocumentService = inject(CustomerTaxDocumentService);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  readonly customerId = input.required<number>();

  protected readonly documents = signal<CustomerTaxDocument[]>([]);
  protected readonly loading = signal(false);
  /** Upload that still needs certificate metadata (drives the link dialog). */
  protected readonly pendingUpload = signal<{ id: number; fileName: string } | null>(null);
  /** Document currently being rejected (drives the reason dialog). */
  protected readonly rejecting = signal<CustomerTaxDocument | null>(null);

  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));

  protected readonly rows = computed<TaxDocumentRow[]>(() => {
    const now = Date.now();
    return this.documents().map((doc) => {
      const isExpired = doc.expirationDate != null && new Date(doc.expirationDate).getTime() <= now;
      // A Verified-but-expired certificate no longer unlocks anything — render
      // it as Expired even though the stored status is still Verified.
      const effective = doc.status === 'Verified' && isExpired ? 'Expired' : doc.status;
      return {
        doc,
        statusKey: `customers.taxDocuments.status${effective}`,
        chipClass: CustomerTaxDocumentsClusterComponent.chipFor(effective),
        typeKey: CustomerTaxDocumentsClusterComponent.TYPE_KEYS[doc.certificateType]
          ?? 'customers.taxDocuments.typeOther',
        isExpired,
        canVerify: effective !== 'Verified',
        canReject: effective !== 'Rejected',
      };
    });
  });

  constructor() {
    effect(() => {
      const id = this.customerId();
      if (id > 0) this.loadDocuments(id);
    });
  }

  private static chipFor(status: string): string {
    switch (status) {
      case 'Verified': return 'chip chip--success';
      case 'Rejected': return 'chip chip--error';
      case 'Expired': return 'chip chip--muted';
      default: return 'chip chip--warning';
    }
  }

  private loadDocuments(id: number): void {
    this.loading.set(true);
    this.taxDocumentService.getTaxDocuments(id).subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onFileUploaded(file: UploadedFile): void {
    // The file is on the customer; now collect the certificate metadata.
    // UploadedFile.id is a string — the create endpoint wants the numeric id.
    this.pendingUpload.set({ id: Number(file.id), fileName: file.fileName });
  }

  protected onDialogSaved(): void {
    this.pendingUpload.set(null);
    this.loadDocuments(this.customerId());
  }

  protected closeDialog(): void {
    this.pendingUpload.set(null);
  }

  protected verify(doc: CustomerTaxDocument): void {
    this.taxDocumentService.verifyTaxDocument(doc.id).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('customers.taxDocuments.documentVerified'));
        this.loadDocuments(this.customerId());
      },
    });
  }

  protected openReject(doc: CustomerTaxDocument): void {
    this.rejecting.set(doc);
  }

  protected onRejected(): void {
    this.rejecting.set(null);
    this.loadDocuments(this.customerId());
  }

  protected closeRejectDialog(): void {
    this.rejecting.set(null);
  }

  protected deleteDocument(doc: CustomerTaxDocument): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.taxDocuments.deleteTitle'),
        message: this.translate.instant('customers.taxDocuments.deleteMessage', { name: doc.fileName }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.taxDocumentService.deleteTaxDocument(doc.id).subscribe({
        next: () => {
          this.documents.update(list => list.filter(d => d.id !== doc.id));
          this.snackbar.success(this.translate.instant('customers.taxDocuments.documentDeleted'));
        },
      });
    });
  }
}
