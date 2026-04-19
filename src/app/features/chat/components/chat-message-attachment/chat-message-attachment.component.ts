import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { ChatFileAttachment } from '../../models/chat-message.model';

@Component({
  selector: 'app-chat-message-attachment',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './chat-message-attachment.component.html',
  styleUrl: './chat-message-attachment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageAttachmentComponent {
  readonly attachment = input.required<ChatFileAttachment>();

  protected readonly isImage = computed(() => {
    const ct = this.attachment().contentType;
    return ct.startsWith('image/');
  });

  protected readonly fileIcon = computed(() => {
    const ct = this.attachment().contentType;
    if (ct === 'application/pdf') return 'picture_as_pdf';
    if (ct.includes('spreadsheet') || ct.includes('excel')) return 'table_chart';
    if (ct.includes('document') || ct.includes('word')) return 'description';
    return 'attach_file';
  });

  protected readonly formattedSize = computed(() => {
    return this.formatSize(this.attachment().size);
  });

  protected download(): void {
    window.open(`/api/v1/files/${this.attachment().id}/download`, '_blank');
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
