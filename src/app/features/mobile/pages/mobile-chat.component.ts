import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal, viewChild, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';
import { debounceTime } from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ChatHubService } from '../../../shared/services/chat-hub.service';
import { ChatService } from '../../chat/services/chat.service';
import { ChatConversation } from '../../chat/models/chat-conversation.model';
import { ChatMessage } from '../../chat/models/chat-message.model';
import { ChatMessageEvent } from '../../chat/models/chat-message-event.model';
import { ChatRoom } from '../../chat/models/chat-room.model';
import { CreateChannelDialogComponent } from '../../chat/components/create-channel-dialog/create-channel-dialog.component';
import { ChannelBrowserDialogComponent } from '../../chat/components/channel-browser-dialog/channel-browser-dialog.component';
import { ChannelSettingsDialogComponent, ChannelSettingsDialogData, ChannelSettingsDialogResult } from '../../chat/components/channel-settings-dialog/channel-settings-dialog.component';
import { ChatChannelListComponent, ChannelSelection } from '../../chat/components/chat-channel-list/chat-channel-list.component';
import { ChatMessageAreaComponent } from '../../chat/components/chat-message-area/chat-message-area.component';
import { ChatChannelHeaderComponent } from '../../chat/components/chat-channel-header/chat-channel-header.component';
import { ChatThreadPanelComponent } from '../../chat/components/chat-thread-panel/chat-thread-panel.component';

type MobileChatView = 'list' | 'dm' | 'channel';

@Component({
  selector: 'app-mobile-chat',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ChatChannelListComponent, ChatMessageAreaComponent, ChatChannelHeaderComponent, ChatThreadPanelComponent],
  templateUrl: './mobile-chat.component.html',
  styleUrl: './mobile-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileChatComponent implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly chatHub = inject(ChatHubService);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly messageArea = viewChild<ChatMessageAreaComponent>('messageArea');

  protected readonly view = signal<MobileChatView>('list');
  protected readonly conversations = signal<ChatConversation[]>([]);
  protected readonly channels = signal<ChatRoom[]>([]);
  protected readonly selectedConversation = signal<ChatConversation | null>(null);
  protected readonly selectedChannel = signal<ChatRoom | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);

  // Search
  protected readonly searchControl = new FormControl('');
  protected readonly searchTerm = signal('');

  // Filtered data for channel list (mobile-specific search)
  protected readonly filteredConversations = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.conversations();
    return this.conversations().filter(c => c.userName.toLowerCase().includes(term));
  });

  protected readonly filteredChannels = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.channels();
    return this.channels().filter(c => c.name.toLowerCase().includes(term));
  });

  // File attachment state
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly pendingFileAttachmentId = signal<number | null>(null);
  protected readonly isUploading = signal(false);

  // Thread state
  protected readonly threadParentMessage = signal<ChatMessage | null>(null);
  protected readonly threadReplies = signal<ChatMessage[]>([]);

  // Computed signals for sub-components
  protected readonly currentUserId = computed(() => this.authService.user()?.id ?? 0);
  protected readonly selectedChannelId = computed(() => this.selectedChannel()?.id ?? null);
  protected readonly selectedUserId = computed(() => this.selectedConversation()?.userId ?? null);
  protected readonly isChannel = computed(() => this.view() === 'channel');
  protected readonly isReadOnly = computed(() => this.selectedChannel()?.isReadOnly ?? false);

  // Swipe state (mobile-specific)
  protected readonly swipedChannelId = signal<number | null>(null);

  // Pull-to-refresh
  protected readonly refreshing = signal(false);

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

  // ── Channel list events ──

  protected onChannelSelected(selection: ChannelSelection): void {
    if (selection.type === 'dm' && selection.conversationUserId != null) {
      const existing = this.conversations().find(c => c.userId === selection.conversationUserId);
      if (existing) {
        this.selectConversation(existing);
      } else {
        // New user selected from picker
        this.loadMessages(selection.conversationUserId);
        this.selectedConversation.set({
          userId: selection.conversationUserId,
          userName: '',
          userInitials: '',
          userColor: '',
          lastMessage: null,
          lastMessageAt: null,
          unreadCount: 0,
        });
        this.selectedChannel.set(null);
        this.view.set('dm');
      }
    } else if (selection.type === 'channel' && selection.channelId != null) {
      const channel = this.channels().find(c => c.id === selection.channelId);
      if (channel) {
        this.selectChannel(channel);
      }
    }
  }

  protected onMuteToggled(event: { channel: ChatRoom; mute: boolean }): void {
    this.chatService.muteChannel(event.channel.id, event.mute).subscribe(() => {
      this.snackbar.info(event.mute ? `Muted #${event.channel.name}` : `Unmuted #${event.channel.name}`);
      this.loadChannels();
    });
  }

  protected onHeaderMuteToggled(mute: boolean): void {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.chatService.muteChannel(channel.id, mute).subscribe(() => {
      this.snackbar.info(mute ? `Muted #${channel.name}` : `Unmuted #${channel.name}`);
      this.loadChannels();
    });
  }

  // ── Navigation ──

  protected backToList(): void {
    const ch = this.selectedChannel();
    if (ch) this.chatHub.leaveChannel(ch.id);
    this.selectedConversation.set(null);
    this.selectedChannel.set(null);
    this.messages.set([]);
    this.clearPendingFile();
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
    this.view.set('list');
    this.loadConversations();
    this.loadChannels();
  }

  // ── Dialogs ──

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

  // ── Message sending ──

  protected onMessageSent(content: string): void {
    const conv = this.selectedConversation();
    const channel = this.selectedChannel();
    const file = this.pendingFile();
    const fileId = this.pendingFileAttachmentId() ?? undefined;

    if (file && !fileId) {
      // Need to upload first
      this.uploadAndSend(content, conv, channel);
      return;
    }

    const onSent = (msg: ChatMessage) => {
      this.messages.update((msgs) => [...msgs, msg]);
      this.clearPendingFile();
      this.messageArea()?.scrollToBottom();
    };

    if (conv) {
      this.chatService.sendMessage(conv.userId, content, fileId).subscribe(onSent);
    } else if (channel) {
      this.chatService.sendChatRoomMessage(channel.id, content, fileId).subscribe(onSent);
    }
  }

  protected onFileSelected(file: File): void {
    this.pendingFile.set(file);

    const channel = this.selectedChannel();
    if (channel) {
      this.isUploading.set(true);
      this.chatService.uploadChatFile(channel.id, file).subscribe({
        next: (attachment) => {
          this.pendingFileAttachmentId.set(attachment.id);
          this.isUploading.set(false);
        },
        error: () => {
          this.pendingFile.set(null);
          this.isUploading.set(false);
          this.snackbar.error('Failed to upload file');
        },
      });
    }
  }

  protected onFileCancelled(): void {
    this.clearPendingFile();
  }

  // ── Thread ──

  protected onThreadOpened(msg: ChatMessage): void {
    this.threadParentMessage.set(msg);
    this.threadReplies.set([]);
    this.chatService.getThread(msg.id).subscribe(replies => {
      this.threadReplies.set(replies);
    });
  }

  protected onThreadReplySent(content: string): void {
    const parent = this.threadParentMessage();
    if (!parent) return;

    this.chatService.replyInThread(parent.id, content).subscribe(reply => {
      this.threadReplies.update(r => [...r, reply]);
      this.messages.update(msgs => msgs.map(m =>
        m.id === parent.id ? { ...m, threadReplyCount: m.threadReplyCount + 1, threadLastReplyAt: new Date() } : m,
      ));
      this.threadParentMessage.update(p => p ? { ...p, threadReplyCount: p.threadReplyCount + 1 } : p);
    });
  }

  protected closeThread(): void {
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
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

  ngOnDestroy(): void {
    this.chatHub.clearMessageCallbacks();
  }

  // ── Private ──

  private selectConversation(conv: ChatConversation): void {
    this.selectedConversation.set(conv);
    this.selectedChannel.set(null);
    this.view.set('dm');
    this.loadMessages(conv.userId);
    this.chatService.markAsRead(conv.userId).subscribe();
  }

  private selectChannel(channel: ChatRoom): void {
    this.selectedChannel.set(channel);
    this.selectedConversation.set(null);
    this.view.set('channel');
    this.loadChannelMessages(channel.id);
    this.chatService.markChannelRead(channel.id).subscribe();
    this.chatHub.joinChannel(channel.id);
  }

  private clearPendingFile(): void {
    this.pendingFile.set(null);
    this.pendingFileAttachmentId.set(null);
  }

  private uploadAndSend(content: string, conv: ChatConversation | null, channel: ChatRoom | null): void {
    const file = this.pendingFile();
    if (!file) return;

    this.isUploading.set(true);

    if (channel) {
      this.chatService.uploadChatFile(channel.id, file).subscribe({
        next: (attachment) => {
          this.isUploading.set(false);
          this.clearPendingFile();
          this.chatService.sendChatRoomMessage(channel.id, content, attachment.id).subscribe((msg) => {
            this.messages.update(msgs => [...msgs, msg]);
            this.messageArea()?.scrollToBottom();
          });
        },
        error: () => {
          this.isUploading.set(false);
          this.snackbar.error('Failed to upload file');
        },
      });
    } else if (conv) {
      this.chatService.uploadChatFile(0, file).subscribe({
        next: (attachment) => {
          this.isUploading.set(false);
          this.clearPendingFile();
          this.chatService.sendMessage(conv.userId, content, attachment.id).subscribe((msg) => {
            this.messages.update(msgs => [...msgs, msg]);
            this.messageArea()?.scrollToBottom();
          });
        },
        error: () => {
          this.isUploading.set(false);
          this.snackbar.error('Failed to upload file');
        },
      });
    }
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
      this.messageArea()?.scrollToBottom();
    });
  }

  private loadMessages(otherUserId: number): void {
    this.chatService.getMessages(otherUserId).subscribe((msgs) => {
      this.messages.set(msgs);
      this.messageArea()?.scrollToBottom();
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
        this.messageArea()?.scrollToBottom();

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
        this.messageArea()?.scrollToBottom();
        this.chatService.markChannelRead(data.roomId).subscribe();
      }
      this.loadChannels();
    });

    await this.chatHub.connect();
    this.hubConnected = true;
  }
}
