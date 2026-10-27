import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ControlledDocumentService } from '../../services/controlled-document.service';
import { ControlledDocument } from '../../models/controlled-document.model';
import { DocumentRevision } from '../../models/document-revision.model';
import { CONTROLLED_DOCUMENT_STATUS_CHIP, ControlledDocumentStatus } from '../../models/controlled-document-status.model';
import { DOCUMENT_REVISION_STATUS_CHIP, DocumentRevisionStatus } from '../../models/document-revision-status.model';
import { DOCUMENT_APPROVER_ROLES, DOCUMENT_AUTHOR_ROLES } from '../../models/controlled-document-roles.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { AuthService } from '../../../../shared/services/auth.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

export interface ControlledDocumentDetailDialogData {
  document: ControlledDocument;
}

@Component({
  selector: 'app-controlled-document-detail-dialog',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe, DialogComponent, TextareaComponent, FileUploadZoneComponent, LoadingBlockDirective],
  templateUrl: './controlled-document-detail-dialog.component.html',
  styleUrl: './controlled-document-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlledDocumentDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ControlledDocumentDetailDialogComponent, boolean>);
  private readonly documentService = inject(ControlledDocumentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly fileDownload = inject(FileDownloadService);
  protected readonly data = inject<ControlledDocumentDetailDialogData>(MAT_DIALOG_DATA);

  protected readonly document = signal<ControlledDocument>(this.data.document);
  protected readonly revisions = signal<DocumentRevision[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly uploadedFile = signal<UploadedFile | null>(null);
  private changed = false;

  protected readonly canAuthor = this.auth.hasAnyRole(DOCUMENT_AUTHOR_ROLES);
  protected readonly canApprove = this.auth.hasAnyRole(DOCUMENT_APPROVER_ROLES);

  protected readonly changeDescription = new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000), Validators.pattern(/\S/)] });

  protected readonly openRevision = computed(() =>
    this.revisions().find(r => r.status === 'Draft' || r.status === 'InReview') ?? null);

  protected readonly canRevise = computed(() =>
    this.canAuthor && this.document().status !== 'Obsolete' && this.openRevision() === null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.documentService.revisions(this.document().id).subscribe({
      next: list => {
        this.revisions.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected documentChip(status: ControlledDocumentStatus): string {
    return `chip ${CONTROLLED_DOCUMENT_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected revisionChip(status: DocumentRevisionStatus): string {
    return `chip ${DOCUMENT_REVISION_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected onUploaded(file: UploadedFile): void {
    this.uploadedFile.set(file);
  }

  protected saveRevision(): void {
    const file = this.uploadedFile();
    if (!file || this.changeDescription.invalid || this.busy()) return;
    this.busy.set(true);
    this.documentService.createRevision(this.document().id, Number(file.id), this.changeDescription.value.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.uploadedFile.set(null);
        this.changeDescription.reset('');
        this.changed = true;
        this.snackbar.success(this.translate.instant('controlledDocuments.revisionCreated'));
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'controlledDocuments.saveFailed');
      },
    });
  }

  protected submit(revision: DocumentRevision): void {
    this.act(this.documentService.submitRevision(this.document().id, revision.id), 'controlledDocuments.revisionSubmitted',
      this.document().status === 'Draft' ? 'InReview' : null);
  }

  protected approve(revision: DocumentRevision): void {
    this.act(this.documentService.approveRevision(this.document().id, revision.id), 'controlledDocuments.revisionApproved', 'Released',
      revision.revisionNumber);
  }

  protected reject(revision: DocumentRevision): void {
    const backToDraft = this.document().status === 'InReview' && !this.revisions().some(r => r.status === 'Approved');
    this.act(this.documentService.rejectRevision(this.document().id, revision.id), 'controlledDocuments.revisionRejected',
      backToDraft ? 'Draft' : null);
  }

  private act(call: ReturnType<ControlledDocumentService['submitRevision']>, messageKey: string,
              documentStatus: ControlledDocumentStatus | null, currentRevision?: number): void {
    if (this.busy()) return;
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.changed = true;
        if (documentStatus) {
          this.document.update(d => ({ ...d, status: documentStatus, currentRevision: currentRevision ?? d.currentRevision }));
        }
        this.snackbar.success(this.translate.instant(messageKey));
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'controlledDocuments.saveFailed');
      },
    });
  }

  protected obsolete(): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('controlledDocuments.obsoleteTitle'),
        message: this.translate.instant('controlledDocuments.obsoleteMessage', { number: this.document().documentNumber }),
        confirmLabel: this.translate.instant('controlledDocuments.obsolete'),
        severity: 'danger',
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.documentService.obsolete(this.document().id).subscribe({
        next: () => {
          this.changed = true;
          this.document.update(d => ({ ...d, status: 'Obsolete' }));
          this.snackbar.success(this.translate.instant('controlledDocuments.obsoleted'));
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'controlledDocuments.saveFailed'),
      });
    });
  }

  protected open(revision: DocumentRevision): void {
    this.fileDownload.openOrDownload(
      this.documentService.fileDownloadUrl(revision.fileAttachmentId), revision.fileName ?? `${this.document().documentNumber}-rev${revision.revisionNumber}`);
  }

  protected close(): void { this.dialogRef.close(this.changed); }
}
