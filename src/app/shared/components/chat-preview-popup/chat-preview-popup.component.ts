import { ChangeDetectionStrategy, Component, inject, effect, signal } from '@angular/core';

import { ChatNotificationService } from '../../services/chat-notification.service';
import { LayoutService } from '../../services/layout.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { ChatMessageEvent } from '../../../features/chat/models/chat-message-event.model';

interface PreviewItem {
  message: ChatMessageEvent;
  dismissTimeout: ReturnType<typeof setTimeout>;
}

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5000;

@Component({
  selector: 'app-chat-preview-popup',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './chat-preview-popup.component.html',
  styleUrl: './chat-preview-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPreviewPopupComponent {
  private readonly chatNotification = inject(ChatNotificationService);
  private readonly layout = inject(LayoutService);

  protected readonly previews = signal<PreviewItem[]>([]);

  constructor() {
    effect(() => {
      const msg = this.chatNotification.latestIncomingMessage();
      if (!msg) return;

      // Don't show on mobile — mobile uses native notification patterns
      if (this.layout.isMobile()) {
        this.chatNotification.clearLatest();
        return;
      }

      this.chatNotification.clearLatest();
      this.addPreview(msg);
    });
  }

  protected dismiss(message: ChatMessageEvent): void {
    this.previews.update(items => {
      const item = items.find(i => i.message === message);
      if (item) clearTimeout(item.dismissTimeout);
      return items.filter(i => i.message !== message);
    });
  }

  protected truncateContent(content: string): string {
    return content.length > 120 ? content.substring(0, 120) + '...' : content;
  }

  private addPreview(message: ChatMessageEvent): void {
    const dismissTimeout = setTimeout(() => {
      this.dismiss(message);
    }, AUTO_DISMISS_MS);

    const item: PreviewItem = { message, dismissTimeout };

    this.previews.update(items => {
      const updated = [item, ...items];
      // Dismiss extras beyond max
      while (updated.length > MAX_VISIBLE) {
        const removed = updated.pop();
        if (removed) clearTimeout(removed.dismissTimeout);
      }
      return updated;
    });
  }
}
