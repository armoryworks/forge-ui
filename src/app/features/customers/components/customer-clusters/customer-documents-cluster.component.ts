import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerService } from '../../services/customer.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FileAttachment } from '../../../../shared/models/file.model';

/**
 * Documents cluster — file attachments on the Customer, served by the shared
 * files API (`GET/POST /api/v1/customers/{id}/files`, download + delete via
 * `/api/v1/files/{id}`). Mounted into the Documents tab on the customer
 * detail page. Follows the doc-list pattern established by the sales-order
 * detail panel's Documents tab: doc rows + always-visible upload zone (no
 * big empty-state block when there are no documents).
 */
@Component({
  selector: 'app-customer-documents-cluster',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    FileUploadZoneComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './customer-documents-cluster.component.html',
  styleUrl: './customer-documents-cluster.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDocumentsClusterComponent {
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  readonly customerId = input.required<number>();

  protected readonly documents = signal<FileAttachment[]>([]);
  protected readonly loading = signal(false);

  constructor() {
    effect(() => {
      const id = this.customerId();
      if (id > 0) this.loadDocuments(id);
    });
  }

  private loadDocuments(id: number): void {
    this.loading.set(true);
    this.customerService.getDocuments(id).subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected downloadFile(doc: FileAttachment): void {
    window.open(this.customerService.downloadFileUrl(doc.id), '_blank');
  }

  protected deleteFile(doc: FileAttachment): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.documents.deleteFileTitle'),
        message: this.translate.instant('customers.documents.deleteFileMessage', { name: doc.fileName }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.customerService.deleteFile(doc.id).subscribe({
        next: () => {
          this.documents.update(list => list.filter(f => f.id !== doc.id));
          this.snackbar.success(this.translate.instant('customers.documents.fileDeleted'));
        },
      });
    });
  }

  protected onFileUploaded(_file: UploadedFile): void {
    this.loadDocuments(this.customerId());
    this.snackbar.success(this.translate.instant('customers.documents.fileUploaded'));
  }

  protected getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'table_chart';
    if (contentType.includes('document') || contentType.includes('word')) return 'description';
    return 'attach_file';
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
