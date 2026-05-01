import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { FileUploadZoneComponent } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FileAttachment } from '../../../../shared/models/file.model';
import { PartsService } from '../../services/parts.service';

/**
 * Pillar 4 — Files cluster. Wraps `<app-file-upload-zone>` and lists the
 * attachments already on the Part. Self-loads via `PartsService` so the
 * tab can mount without parent wiring.
 */
@Component({
  selector: 'app-part-files-cluster',
  standalone: true,
  imports: [TranslatePipe, FileUploadZoneComponent, EmptyStateComponent],
  templateUrl: './part-files-cluster.component.html',
  styleUrl: './part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartFilesClusterComponent implements OnInit {
  protected readonly partsService = inject(PartsService);

  readonly partId = input.required<number>();
  readonly uploaded = output<void>();

  protected readonly files = signal<FileAttachment[]>([]);

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    const id = this.partId();
    this.partsService.getPartFiles(id).subscribe({
      next: (files) => this.files.set(files),
    });
  }

  protected onFileUploaded(): void {
    this.refresh();
    this.uploaded.emit();
  }
}
