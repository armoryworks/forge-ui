import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FileAttachment } from '../../../shared/models/file.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../shared/components/file-upload-zone/file-upload-zone.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { KanbanService } from '../services/kanban.service';

export interface CoverPhotoDialogData {
  jobId: number;
  currentCoverPhotoUrl: string | null;
}

@Component({
  selector: 'app-cover-photo-upload-dialog',
  standalone: true,
  imports: [DialogComponent, FileUploadZoneComponent, MatTooltipModule, TranslatePipe],
  templateUrl: './cover-photo-upload-dialog.component.html',
  styleUrl: './cover-photo-upload-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverPhotoUploadDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<CoverPhotoUploadDialogComponent>);
  readonly data = inject<CoverPhotoDialogData>(MAT_DIALOG_DATA);
  private readonly kanbanService = inject(KanbanService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly files = signal<FileAttachment[]>([]);
  protected readonly saving = signal(false);

  protected readonly imageFiles = () =>
    this.files().filter(f => f.contentType.startsWith('image/'));

  ngOnInit(): void {
    this.kanbanService.getJobFiles(this.data.jobId).subscribe(f => this.files.set(f));
  }

  protected selectFile(file: FileAttachment): void {
    this.saving.set(true);
    this.kanbanService.setCoverPhoto(this.data.jobId, file.id).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('kanban.coverPhotoSet'));
        this.dialogRef.close({ coverPhotoUrl: `/api/v1/files/${file.id}`, fileId: file.id });
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  protected removeCoverPhoto(): void {
    this.saving.set(true);
    this.kanbanService.setCoverPhoto(this.data.jobId, null).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('kanban.coverPhotoRemoved'));
        this.dialogRef.close({ coverPhotoUrl: null, fileId: null });
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  protected onFileUploaded(_file: UploadedFile): void {
    this.kanbanService.getJobFiles(this.data.jobId).subscribe(f => this.files.set(f));
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
