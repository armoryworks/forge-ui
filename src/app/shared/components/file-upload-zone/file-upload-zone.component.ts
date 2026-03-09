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
}

@Component({
  selector: 'app-file-upload-zone',
  standalone: true,
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

    for (const file of files) {
      if (file.size > maxBytes) {
        this.addUploadError(file.name, `File exceeds ${this.maxSizeMb()}MB limit`);
        continue;
      }

      if (this.accept() && !this.isAccepted(file)) {
        this.addUploadError(file.name, 'File type not allowed');
        continue;
      }

      this.uploadFile(file);
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
