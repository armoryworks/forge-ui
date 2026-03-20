import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';

import { TranslatePipe } from '@ngx-translate/core';

export interface UploadedFile {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
}

export interface FileUploadProgress {
  fileName: string;
  progress: number;
  error?: string;
  chunked?: boolean;
}

interface ChunkedUploadResponse {
  uploadId: string;
  chunkIndex: number;
  isComplete: boolean;
  fileAttachment: UploadedFile | null;
}

@Component({
  selector: 'app-file-upload-zone',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './file-upload-zone.component.html',
  styleUrl: './file-upload-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadZoneComponent {
  private readonly http = inject(HttpClient);

  readonly entityType = input.required<string>();
  readonly entityId = input.required<string | number>();
  readonly accept = input<string>('');
  readonly maxSizeMb = input<number>(50);
  readonly multiple = input(true);
  /** Files larger than this threshold use chunked upload. Default: 5MB. */
  readonly chunkSizeMb = input<number>(5);

  readonly uploaded = output<UploadedFile>();

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly dragOver = signal(false);
  protected readonly uploads = signal<FileUploadProgress[]>([]);

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.handleFiles(files);
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files);
      input.value = '';
    }
  }

  protected browse(): void {
    this.fileInput()?.nativeElement.click();
  }

  private handleFiles(fileList: FileList): void {
    const files = Array.from(fileList);
    const maxBytes = this.maxSizeMb() * 1024 * 1024;
    const chunkBytes = this.chunkSizeMb() * 1024 * 1024;

    for (const file of files) {
      if (file.size > maxBytes) {
        this.addUploadError(file.name, `File exceeds ${this.maxSizeMb()}MB limit`);
        continue;
      }

      if (this.accept() && !this.isAccepted(file)) {
        this.addUploadError(file.name, 'File type not allowed');
        continue;
      }

      if (file.size > chunkBytes) {
        this.uploadFileChunked(file, chunkBytes);
      } else {
        this.uploadFile(file);
      }
    }
  }

  private isAccepted(file: File): boolean {
    const accepted = this.accept().split(',').map(a => a.trim().toLowerCase());
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const mime = file.type.toLowerCase();

    return accepted.some(a =>
      a === ext || a === mime || (a.endsWith('/*') && mime.startsWith(a.replace('/*', '/')))
    );
  }

  // ── Single-upload path (unchanged behavior) ─────────────────────────────────

  private uploadFile(file: File): void {
    const formData = new FormData();
    formData.append('file', file);

    const progress: FileUploadProgress = { fileName: file.name, progress: 0 };
    this.uploads.update(list => [...list, progress]);

    this.http.post<UploadedFile>(
      `/api/v1/${this.entityType()}/${this.entityId()}/files`,
      formData,
      { reportProgress: true, observe: 'events' },
    ).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.updateProgress(file.name, Math.round((event.loaded / event.total) * 100));
        } else if (event.type === HttpEventType.Response && event.body) {
          this.removeUpload(file.name);
          this.uploaded.emit(event.body);
        }
      },
      error: () => {
        this.updateUploadError(file.name, 'Upload failed');
      },
    });
  }

  // ── Chunked-upload path ──────────────────────────────────────────────────────

  private uploadFileChunked(file: File, chunkBytes: number): void {
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / chunkBytes);
    const progress: FileUploadProgress = { fileName: file.name, progress: 0, chunked: true };
    this.uploads.update(list => [...list, progress]);

    this.sendNextChunk(file, uploadId, 0, totalChunks, chunkBytes);
  }

  private sendNextChunk(
    file: File,
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    chunkBytes: number,
  ): void {
    const start = chunkIndex * chunkBytes;
    const end = Math.min(start + chunkBytes, file.size);
    const chunkBlob = file.slice(start, end);

    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('fileName', file.name);
    formData.append('contentType', file.type || 'application/octet-stream');
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));
    formData.append('chunk', chunkBlob, file.name);

    this.http.post<ChunkedUploadResponse>(
      `/api/v1/${this.entityType()}/${this.entityId()}/files/chunked`,
      formData,
    ).subscribe({
      next: response => {
        const sentChunks = chunkIndex + 1;
        const pct = Math.round((sentChunks / totalChunks) * 100);
        this.updateProgress(file.name, pct);

        if (response.isComplete && response.fileAttachment) {
          this.removeUpload(file.name);
          this.uploaded.emit(response.fileAttachment);
          return;
        }

        this.sendNextChunk(file, uploadId, chunkIndex + 1, totalChunks, chunkBytes);
      },
      error: () => {
        this.updateUploadError(file.name, 'Upload failed');
      },
    });
  }

  // ── Progress helpers ─────────────────────────────────────────────────────────

  private addUploadError(fileName: string, error: string): void {
    this.uploads.update(list => [...list, { fileName, progress: 0, error }]);
    setTimeout(() => this.removeUpload(fileName), 5000);
  }

  private updateProgress(fileName: string, progress: number): void {
    this.uploads.update(list =>
      list.map(u => u.fileName === fileName ? { ...u, progress } : u)
    );
  }

  private updateUploadError(fileName: string, error: string): void {
    this.uploads.update(list =>
      list.map(u => u.fileName === fileName ? { ...u, error } : u)
    );
  }

  private removeUpload(fileName: string): void {
    this.uploads.update(list => list.filter(u => u.fileName !== fileName));
  }
}
