import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, signal, computed, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { AuthService } from '../../../shared/services/auth.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { ChatHubService } from '../../../shared/services/chat-hub.service';
import { ChatService } from '../../chat/services/chat.service';
import { ChatConversation } from '../../chat/models/chat-conversation.model';
import { ChatMessage } from '../../chat/models/chat-message.model';
import { ChatMessageEvent } from '../../chat/models/chat-message-event.model';
import { formatDate } from '../../../shared/utils/date.utils';

interface UserListItem {
  id: number;
  initials: string;
  name: string;
  color: string;
}

@Component({
  selector: 'app-mobile-chat',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent, TranslatePipe],
  templateUrl: './mobile-chat.component.html',
  styleUrl: './mobile-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileChatComponent implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly chatHub = inject(ChatHubService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);

  private readonly messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesContainer');

  protected readonly conversations = signal<ChatConversation[]>([]);
  protected readonly selectedConversation = signal<ChatConversation | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly messageControl = new FormControl('');

  // New conversation state
  protected readonly showUserPicker = signal(false);
  protected readonly allUsers = signal<UserListItem[]>([]);
  protected readonly userSearchControl = new FormControl('');
  protected readonly userSearchTerm = signal('');
  protected readonly filteredUsers = computed(() => {
    const term = this.userSearchTerm().toLowerCase();
    const currentUserId = this.authService.user()?.id;
    const existingUserIds = new Set(this.conversations().map(c => c.userId));
    return this.allUsers()
      .filter(u => u.id !== currentUserId)
      .filter(u => !term || u.name.toLowerCase().includes(term))
      .filter(u => !existingUserIds.has(u.id));
  });

  private hubConnected = false;

  constructor() {
    this.loadConversations();
    this.connectHub();
  }

  protected selectConversation(conv: ChatConversation): void {
    this.selectedConversation.set(conv);
    this.loadMessages(conv.userId);
    this.chatService.markAsRead(conv.userId).subscribe();
  }

  protected backToList(): void {
    this.selectedConversation.set(null);
    this.messages.set([]);
    this.showUserPicker.set(false);
    this.loadConversations();
  }

  protected openUserPicker(): void {
    this.showUserPicker.set(true);
    this.userSearchControl.setValue('');
    this.userSearchTerm.set('');
    if (this.allUsers().length === 0) {
      this.http.get<UserListItem[]>('/api/v1/users').subscribe(users => {
        this.allUsers.set(users);
      });
    }
    this.userSearchControl.valueChanges.subscribe(v => this.userSearchTerm.set(v ?? ''));
  }

  protected selectUser(user: UserListItem): void {
    this.showUserPicker.set(false);
    const conv: ChatConversation = {
      userId: user.id,
      userName: user.name,
      userInitials: user.initials,
      userColor: user.color,
      lastMessage: null,
      lastMessageAt: null,
      unreadCount: 0,
    };
    this.selectedConversation.set(conv);
    this.loadMessages(user.id);
  }

  protected cancelUserPicker(): void {
    this.showUserPicker.set(false);
  }

  protected sendMessage(): void {
    const conv = this.selectedConversation();
    const content = this.messageControl.value?.trim();
    if (!conv || !content) return;

    this.chatService.sendMessage(conv.userId, content).subscribe((msg) => {
      this.messages.update((msgs) => [...msgs, msg]);
      this.messageControl.setValue('');
      this.scrollToBottom();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
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

  private loadConversations(): void {
    this.chatService.getConversations().subscribe((convs) => {
      this.conversations.set(convs);
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
}
