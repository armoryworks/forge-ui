import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, signal, computed, viewChild, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';
import { debounceTime } from 'rxjs';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { ChatHubService } from '../../../shared/services/chat-hub.service';
import { ChatService } from '../../chat/services/chat.service';
import { ChatConversation } from '../../chat/models/chat-conversation.model';
import { ChatMessage, ChatFileAttachment } from '../../chat/models/chat-message.model';
import { ChatMessageEvent } from '../../chat/models/chat-message-event.model';
import { ChatRoom } from '../../chat/models/chat-room.model';
import { CreateChannelDialogComponent } from '../../chat/components/create-channel-dialog/create-channel-dialog.component';
import { ChannelBrowserDialogComponent } from '../../chat/components/channel-browser-dialog/channel-browser-dialog.component';
import { ChannelSettingsDialogComponent, ChannelSettingsDialogData, ChannelSettingsDialogResult } from '../../chat/components/channel-settings-dialog/channel-settings-dialog.component';
import { MentionRenderPipe } from '../../chat/pipes/mention-render.pipe';
import { formatDate } from '../../../shared/utils/date.utils';

interface UserListItem {
  id: number;
  initials: string;
  name: string;
  color: string;
}

type MobileChatView = 'list' | 'dm' | 'channel' | 'userPicker';

@Component({
  selector: 'app-mobile-chat',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent, TranslatePipe, MentionRenderPipe],
  templateUrl: './mobile-chat.component.html',
  styleUrl: './mobile-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileChatComponent implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly chatHub = inject(ChatHubService);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesContainer');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly view = signal<MobileChatView>('list');
  protected readonly conversations = signal<ChatConversation[]>([]);
  protected readonly channels = signal<ChatRoom[]>([]);
  protected readonly selectedConversation = signal<ChatConversation | null>(null);
  protected readonly selectedChannel = signal<ChatRoom | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly messageControl = new FormControl('');
  protected readonly channelSectionsExpanded = signal<Record<string, boolean>>({
    dms: true,
    channels: true,
    teams: true,
    system: true,
  });

  // Search
  protected readonly searchControl = new FormControl('');
  protected readonly searchTerm = signal('');

  // New conversation state
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

  // Computed channel groups with search filtering
  protected readonly filteredConversations = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.conversations();
    return this.conversations().filter(c => c.userName.toLowerCase().includes(term));
  });

  protected readonly groupChannels = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.channels()
      .filter(c => c.channelType === 'Group' || c.channelType === 'Custom')
      .filter(c => !term || c.name.toLowerCase().includes(term));
  });

  protected readonly teamChannels = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.channels()
      .filter(c => c.channelType === 'TeamAuto')
      .filter(c => !term || c.name.toLowerCase().includes(term));
  });

  protected readonly systemChannels = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.channels()
      .filter(c => c.channelType === 'System' || c.channelType === 'Broadcast')
      .filter(c => !term || c.name.toLowerCase().includes(term));
  });

  // File attachment state
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly pendingFilePreview = signal<string | null>(null);
  protected readonly uploadingFile = signal(false);

  // Thread state
  protected readonly threadParentMessage = signal<ChatMessage | null>(null);
  protected readonly threadReplies = signal<ChatMessage[]>([]);
  protected readonly threadReplyControl = new FormControl('');

  protected readonly topLevelMessages = computed(() =>
    this.messages().filter(m => !m.parentMessageId),
  );

  // Pull-to-refresh
  protected readonly refreshing = signal(false);

  // Swipe state
  protected readonly swipedChannelId = signal<number | null>(null);

  private hubConnected = false;

  constructor() {
    this.loadConversations();
    this.loadChannels();
    this.connectHub();

    this.searchControl.valueChanges.pipe(
      debounceTime(200),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(v => this.searchTerm.set(v ?? ''));
  }

  protected selectConversation(conv: ChatConversation): void {
    this.selectedConversation.set(conv);
    this.selectedChannel.set(null);
    this.view.set('dm');
    this.loadMessages(conv.userId);
    this.chatService.markAsRead(conv.userId).subscribe();
  }

  protected selectChannel(channel: ChatRoom): void {
    this.selectedChannel.set(channel);
    this.selectedConversation.set(null);
    this.view.set('channel');
    this.loadChannelMessages(channel.id);
    this.chatService.markChannelRead(channel.id).subscribe();
    this.chatHub.joinChannel(channel.id);
  }

  protected backToList(): void {
    const ch = this.selectedChannel();
    if (ch) this.chatHub.leaveChannel(ch.id);
    this.selectedConversation.set(null);
    this.selectedChannel.set(null);
    this.messages.set([]);
    this.clearPendingFile();
    this.view.set('list');
    this.loadConversations();
    this.loadChannels();
  }

  protected openUserPicker(): void {
    this.view.set('userPicker');
    this.userSearchControl.setValue('');
    this.userSearchTerm.set('');
    if (this.allUsers().length === 0) {
      this.http.get<UserListItem[]>('/api/v1/users').subscribe(users => {
        this.allUsers.set(users);
      });
    }
    this.userSearchControl.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(v => this.userSearchTerm.set(v ?? ''));
  }

  protected selectUser(user: UserListItem): void {
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
    this.selectedChannel.set(null);
    this.view.set('dm');
    this.loadMessages(user.id);
  }

  protected cancelUserPicker(): void {
    this.view.set('list');
  }

  protected openCreateChannel(): void {
    this.dialog.open(CreateChannelDialogComponent, { width: '520px' })
      .afterClosed().subscribe((result: ChatRoom | undefined) => {
        if (result) {
          this.loadChannels();
          this.selectChannel(result);
        }
      });
  }

  protected openBrowseChannels(): void {
    this.dialog.open(ChannelBrowserDialogComponent, { width: '520px' })
      .afterClosed().subscribe((result: ChatRoom | undefined) => {
        if (result) {
          this.loadChannels();
          this.selectChannel(result);
        }
      });
  }

  protected openChannelSettings(): void {
    const channel = this.selectedChannel();
    if (!channel) return;

    this.dialog.open(ChannelSettingsDialogComponent, {
      width: '520px',
      data: { channel } satisfies ChannelSettingsDialogData,
    }).afterClosed().subscribe((result: ChannelSettingsDialogResult) => {
      if (result === 'left') {
        this.backToList();
      } else if (result === 'updated') {
        this.loadChannels();
      }
    });
  }

  protected navigateToChannelInfo(): void {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.router.navigate(['channel-info', channel.id], {
      relativeTo: this.route,
      state: { channel },
    });
  }

  protected toggleSection(section: string): void {
    this.channelSectionsExpanded.update(s => ({ ...s, [section]: !s[section] }));
  }

  // ── File attachment ──

  protected openFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.pendingFile.set(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.pendingFilePreview.set(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      this.pendingFilePreview.set(null);
    }

    // Reset file input so same file can be re-selected
    input.value = '';
  }

  protected clearPendingFile(): void {
    this.pendingFile.set(null);
    this.pendingFilePreview.set(null);
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    return 'attach_file';
  }

  // ── Send message ──

  protected sendMessage(): void {
    const content = this.messageControl.value?.trim() ?? '';
    const file = this.pendingFile();

    if (!content && !file) return;

    const conv = this.selectedConversation();
    const channel = this.selectedChannel();

    if (file) {
      this.uploadAndSend(content, conv, channel);
    } else if (conv) {
      this.chatService.sendMessage(conv.userId, content).subscribe((msg) => {
        this.messages.update((msgs) => [...msgs, msg]);
        this.messageControl.setValue('');
        this.scrollToBottom();
      });
    } else if (channel) {
      this.chatService.sendChatRoomMessage(channel.id, content).subscribe((msg) => {
        this.messages.update((msgs) => [...msgs, msg]);
        this.messageControl.setValue('');
        this.scrollToBottom();
      });
    }
  }

  private uploadAndSend(content: string, conv: ChatConversation | null, channel: ChatRoom | null): void {
    const file = this.pendingFile();
    if (!file) return;

    this.uploadingFile.set(true);

    // For channels, upload to chat-room file endpoint
    if (channel) {
      this.chatService.uploadChatFile(channel.id, file).subscribe({
        next: (attachment) => {
          this.uploadingFile.set(false);
          this.clearPendingFile();
          this.chatService.sendChatRoomMessage(channel.id, content, attachment.id).subscribe((msg) => {
            this.messages.update(msgs => [...msgs, msg]);
            this.messageControl.setValue('');
            this.scrollToBottom();
          });
        },
        error: () => {
          this.uploadingFile.set(false);
          this.snackbar.error('Failed to upload file');
        },
      });
    } else if (conv) {
      // For DMs, upload via a temp channel or DM file upload
      // Use the general chat file upload with a pseudo room ID
      this.chatService.uploadChatFile(0, file).subscribe({
        next: (attachment) => {
          this.uploadingFile.set(false);
          this.clearPendingFile();
          this.chatService.sendMessage(conv.userId, content, attachment.id).subscribe((msg) => {
            this.messages.update(msgs => [...msgs, msg]);
            this.messageControl.setValue('');
            this.scrollToBottom();
          });
        },
        error: () => {
          this.uploadingFile.set(false);
          this.snackbar.error('Failed to upload file');
        },
      });
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ── Thread navigation ──

  protected openThread(msg: ChatMessage): void {
    this.threadParentMessage.set(msg);
    this.threadReplies.set([]);
    this.threadReplyControl.setValue('');
    this.chatService.getThread(msg.id).subscribe(replies => {
      this.threadReplies.set(replies);
    });
  }

  protected openThreadRoute(msg: ChatMessage): void {
    this.router.navigate(['thread', msg.id], {
      relativeTo: this.route,
      state: { parentMessage: msg },
    });
  }

  protected closeThread(): void {
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
  }

  protected sendThreadReply(): void {
    const content = this.threadReplyControl.value?.trim();
    const parent = this.threadParentMessage();
    if (!content || !parent) return;

    this.chatService.replyInThread(parent.id, content).subscribe(reply => {
      this.threadReplies.update(r => [...r, reply]);
      this.threadReplyControl.setValue('');
      this.messages.update(msgs => msgs.map(m =>
        m.id === parent.id ? { ...m, threadReplyCount: m.threadReplyCount + 1 } : m,
      ));
    });
  }

  protected onThreadKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendThreadReply();
    }
  }

  // ── Pull to refresh ──

  protected onPullRefresh(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);

    const conv = this.selectedConversation();
    const channel = this.selectedChannel();

    if (conv) {
      this.chatService.getMessages(conv.userId).subscribe({
        next: (msgs) => {
          this.messages.set(msgs);
          this.refreshing.set(false);
        },
        error: () => this.refreshing.set(false),
      });
    } else if (channel) {
      this.chatService.getChatRoomMessages(channel.id).subscribe({
        next: (msgs) => {
          this.messages.set(msgs);
          this.refreshing.set(false);
        },
        error: () => this.refreshing.set(false),
      });
    } else {
      this.loadConversations();
      this.loadChannels();
      this.refreshing.set(false);
    }
  }

  // ── Swipe to mute ──

  private touchStartX = 0;

  protected onTouchStart(event: TouchEvent, channelId: number): void {
    this.touchStartX = event.touches[0].clientX;
    // Clear any previously swiped channel
    if (this.swipedChannelId() !== channelId) {
      this.swipedChannelId.set(null);
    }
  }

  protected onTouchEnd(event: TouchEvent, channel: ChatRoom): void {
    const touchEndX = event.changedTouches[0].clientX;
    const diff = this.touchStartX - touchEndX;

    if (diff > 60) {
      // Swipe left — show mute action
      this.swipedChannelId.set(channel.id);
    } else if (diff < -60) {
      // Swipe right — dismiss action
      this.swipedChannelId.set(null);
    }
  }

  protected toggleChannelMute(channel: ChatRoom, event: Event): void {
    event.stopPropagation();
    const member = channel.members.find(m => m.userId === this.authService.user()?.id);
    const currentlyMuted = member?.isMuted ?? false;

    this.chatService.muteChannel(channel.id, !currentlyMuted).subscribe({
      next: () => {
        this.snackbar.info(currentlyMuted ? `Unmuted #${channel.name}` : `Muted #${channel.name}`);
        this.swipedChannelId.set(null);
        this.loadChannels();
      },
    });
  }

  protected isChannelMuted(channel: ChatRoom): boolean {
    const member = channel.members.find(m => m.userId === this.authService.user()?.id);
    return member?.isMuted ?? false;
  }

  // ── Helpers ──

  protected isOwnMessage(msg: ChatMessage): boolean {
    return msg.senderId === this.authService.user()?.id;
  }

  protected formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected dateSeparator(index: number): string | null {
    const msgs = this.topLevelMessages();
    const current = new Date(msgs[index].createdAt);
    const currentDay = this.toDayKey(current);

    if (index === 0) {
      return this.isToday(current) ? null : this.formatDayLabel(current);
    }

    const prev = new Date(msgs[index - 1].createdAt);
    const prevDay = this.toDayKey(prev);

    if (currentDay !== prevDay) {
      return this.isToday(current) ? 'Today' : this.formatDayLabel(current);
    }
    return null;
  }

  protected isInputDisabled(): boolean {
    const ch = this.selectedChannel();
    if (!ch) return false;
    return ch.isReadOnly;
  }

  protected getChannelIcon(channel: ChatRoom): string {
    if (channel.iconName) return channel.iconName;
    switch (channel.channelType) {
      case 'System': return 'forum';
      case 'Broadcast': return 'campaign';
      case 'TeamAuto': return 'group';
      case 'Custom': return 'tag';
      default: return 'chat';
    }
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

  ngOnDestroy(): void {
    if (this.hubConnected) {
      this.chatHub.disconnect();
    }
  }

  private toDayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  private isToday(d: Date): boolean {
    const now = new Date();
    return this.toDayKey(d) === this.toDayKey(now);
  }

  private formatDayLabel(d: Date): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (this.toDayKey(d) === this.toDayKey(yesterday)) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  private loadConversations(): void {
    this.chatService.getConversations().subscribe((convs) => {
      this.conversations.set(convs);
    });
  }

  private loadChannels(): void {
    this.chatService.getChannels().subscribe((chs) => {
      this.channels.set(chs);
    });
  }

  private loadChannelMessages(channelId: number): void {
    this.chatService.getChatRoomMessages(channelId).subscribe((msgs) => {
      this.messages.set(msgs);
      this.scrollToBottom();
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
        const chatMessage: ChatMessage = { ...msg, isRead: true, chatRoomId: null, fileAttachment: null, linkedEntityType: null, linkedEntityId: null, parentMessageId: msg.parentMessageId ?? null, threadReplyCount: msg.threadReplyCount ?? 0, threadLastReplyAt: null, mentions: [] };
        this.messages.update((msgs) => [...msgs, chatMessage]);
        this.scrollToBottom();

        if (msg.senderId !== currentUserId) {
          this.chatService.markAsRead(msg.senderId).subscribe();
        }
      }

      this.loadConversations();
    });

    this.chatHub.onRoomMessageReceived((event: unknown) => {
      const data = event as { roomId: number; message: ChatMessageEvent };
      const selectedChannelId = this.selectedChannel()?.id;
      if (data.roomId === selectedChannelId) {
        const chatMessage: ChatMessage = {
          ...data.message,
          isRead: true,
          chatRoomId: data.roomId,
          fileAttachment: null,
          linkedEntityType: null,
          linkedEntityId: null,
          parentMessageId: data.message.parentMessageId ?? null,
          threadReplyCount: data.message.threadReplyCount ?? 0,
          threadLastReplyAt: null,
          mentions: [],
        };
        this.messages.update((msgs) => [...msgs, chatMessage]);
        this.scrollToBottom();
        this.chatService.markChannelRead(data.roomId).subscribe();
      }
      this.loadChannels();
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
