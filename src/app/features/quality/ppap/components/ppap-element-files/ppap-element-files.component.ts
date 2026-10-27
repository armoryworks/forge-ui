import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { PpapService } from '../../services/ppap.service';
import { FileAttachment } from '../../../../../shared/models/file.model';
import { FileUploadZoneComponent } from '../../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { FileDownloadService } from '../../../../../shared/services/file-download.service';

@Component({
  selector: 'app-ppap-element-files',
  standalone: true,
  imports: [DatePipe, TranslatePipe, FileUploadZoneComponent],
  templateUrl: './ppap-element-files.component.html',
  styleUrl: './ppap-element-files.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PpapElementFilesComponent {
  private readonly ppapService = inject(PpapService);
  private readonly fileDownload = inject(FileDownloadService);
  private readonly destroyRef = inject(DestroyRef);

  readonly elementId = input.required<number>();
  readonly canUpload = input(false);
  readonly changed = output<number>();

  protected readonly files = signal<FileAttachment[]>([]);

  constructor() {
    effect(() => this.load(this.elementId()));
  }

  private load(elementId: number): void {
    this.ppapService.elementFiles(elementId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: files => this.files.set(files),
    });
  }

  protected onUploaded(): void {
    this.ppapService.elementFiles(this.elementId()).subscribe({
      next: files => {
        this.files.set(files);
        this.changed.emit(files.length);
      },
    });
  }

  protected download(file: FileAttachment): void {
    this.fileDownload.openOrDownload(this.ppapService.fileDownloadUrl(file.id), file.fileName, file.contentType);
  }
}
