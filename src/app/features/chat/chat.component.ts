import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatTooltipModule } from '@angular/material/tooltip';

import { formatDate } from '../../shared/utils/date.utils';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { AuthService } from '../../shared/services/auth.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { ChatHubService } from '../../shared/services/chat-hub.service';
import { ChatService } from './services/chat.service';
import { ChatConversation } from './models/chat-conversation.model';
import { ChatMessage } from './models/chat-message.model';
import { ChatMessageEvent } from './models/chat-message-event.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, AvatarComponent, TranslatePipe],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly chatHub = inject(ChatHubService);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);

  private readonly messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesContainer');

  readonly panelOpen = signal(false);
  protected readonly conversations = signal<ChatConversation[]>([]);
  protected readonly selectedConversation = signal<ChatConversation | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly messageControl = new FormControl('');
  readonly totalUnread = signal(0);

  private hubConnected = false;

  toggle(): void {
    const isOpen = !this.panelOpen();
    this.panelOpen.set(isOpen);

    if (isOpen) {
      this.loadConversations();
      this.connectHub();
    } else {
      this.selectedConversation.set(null);
      this.messages.set([]);
    }
  }

  selectConversation(conv: ChatConversation): void {
    this.selectedConversation.set(conv);
    this.loadMessages(conv.userId);
    this.chatService.markAsRead(conv.userId).subscribe();
  }

  backToList(): void {
    this.selectedConversation.set(null);
    this.messages.set([]);
    this.loadConversations();
  }

  sendMessage(): void {
    const conv = this.selectedConversation();
    const content = this.messageControl.value?.trim();
    if (!conv || !content) return;

    this.chatService.sendMessage(conv.userId, content).subscribe((msg) => {
      this.messages.update((msgs) => [...msgs, msg]);
      this.messageControl.setValue('');
      this.scrollToBottom();
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  ngOnDestroy(): void {
    if (this.hubConnected) {
      this.chatHub.disconnect();
    }
  }

  private loadConversations(): void {
    this.chatService.getConversations().subscribe((convs) => {
      this.conversations.set(convs);
      this.totalUnread.set(convs.reduce((sum, c) => sum + c.unreadCount, 0));
    });
  }

  private loadMessages(otherUserId: number): void {
    this.chatService.getMessages(otherUserId).subscribe((msgs) => {
      this.messages.set(msgs);
      this.scrollToBottom();
    });
  }

  private async connectHub(): Promise<void> {
    if (this.hubConnected) return;

    this.chatHub.onMessageReceived((event: unknown) => {
      const msg = event as ChatMessageEvent;
      const currentUserId = this.authService.user()?.id;
      const selectedUserId = this.selectedConversation()?.userId;

      if (msg.senderId === selectedUserId || msg.recipientId === selectedUserId) {
        const chatMessage: ChatMessage = { ...msg, isRead: true, chatRoomId: null, fileAttachment: null, linkedEntityType: null, linkedEntityId: null };
        this.messages.update((msgs) => [...msgs, chatMessage]);
        this.scrollToBottom();

        if (msg.senderId !== currentUserId) {
          this.chatService.markAsRead(msg.senderId).subscribe();
        }
      }

      this.loadConversations();
    });

    await this.chatHub.connect();
    this.hubConnected = true;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.messagesContainer()?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  protected isOwnMessage(msg: ChatMessage): boolean {
    return msg.senderId === this.authService.user()?.id;
  }

  protected formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return this.translate.instant('chat.justNow');
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return formatDate(date);
  }
}
