import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal, computed, viewChild } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../shared/services/auth.service';
import { ChatHubService } from '../../shared/services/chat-hub.service';
import { ChatService } from './services/chat.service';
import { ChatConversation } from './models/chat-conversation.model';
import { ChatMessage } from './models/chat-message.model';
import { ChatMessageEvent } from './models/chat-message-event.model';
import { ChatRoom } from './models/chat-room.model';
import { CreateChannelDialogComponent } from './components/create-channel-dialog/create-channel-dialog.component';
import { ChannelBrowserDialogComponent } from './components/channel-browser-dialog/channel-browser-dialog.component';
import { ChannelSettingsDialogComponent, ChannelSettingsDialogData, ChannelSettingsDialogResult } from './components/channel-settings-dialog/channel-settings-dialog.component';
import { ChatChannelListComponent, ChannelSelection } from './components/chat-channel-list/chat-channel-list.component';
import { ChatMessageAreaComponent } from './components/chat-message-area/chat-message-area.component';
import { ChatChannelHeaderComponent } from './components/chat-channel-header/chat-channel-header.component';
import { ChatThreadPanelComponent } from './components/chat-thread-panel/chat-thread-panel.component';

type ChatView = 'list' | 'dm' | 'channel';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe, ChatChannelListComponent, ChatMessageAreaComponent, ChatChannelHeaderComponent, ChatThreadPanelComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly chatHub = inject(ChatHubService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  private readonly messageArea = viewChild<ChatMessageAreaComponent>('messageArea');

  readonly panelOpen = signal(false);
  readonly isRoutedPage = signal(false);
  protected readonly view = signal<ChatView>('list');
  protected readonly conversations = signal<ChatConversation[]>([]);
  protected readonly channels = signal<ChatRoom[]>([]);
  protected readonly selectedConversation = signal<ChatConversation | null>(null);
  protected readonly selectedChannel = signal<ChatRoom | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  readonly totalUnread = signal(0);

  // File attachment state
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly pendingFileAttachmentId = signal<number | null>(null);
  protected readonly isUploading = signal(false);

  // Thread state
  protected readonly threadParentMessage = signal<ChatMessage | null>(null);
  protected readonly threadReplies = signal<ChatMessage[]>([]);

  protected readonly currentUserId = computed(() => this.authService.user()?.id ?? 0);
  protected readonly selectedChannelId = computed(() => this.selectedChannel()?.id ?? null);
  protected readonly selectedUserId = computed(() => this.selectedConversation()?.userId ?? null);
  protected readonly isChannel = computed(() => this.view() === 'channel');
  protected readonly isReadOnly = computed(() => this.selectedChannel()?.isReadOnly ?? false);

  private hubConnected = false;

  ngOnInit(): void {
    if (this.route.snapshot.routeConfig !== null) {
      this.isRoutedPage.set(true);
      this.panelOpen.set(true);
      this.loadConversations();
      this.loadChannels();
      this.connectHub();
    }
  }

  popOut(): void {
    window.open('/chat/popout', 'qb-chat', 'width=800,height=600');
    this.panelOpen.set(false);
  }

  toggle(): void {
    const isOpen = !this.panelOpen();
    this.panelOpen.set(isOpen);

    if (isOpen) {
      this.loadConversations();
      this.loadChannels();
      this.connectHub();
    } else {
      this.selectedConversation.set(null);
      this.selectedChannel.set(null);
      this.messages.set([]);
      this.view.set('list');
    }
  }

  protected onChannelSelected(selection: ChannelSelection): void {
    if (selection.type === 'dm' && selection.conversationUserId != null) {
      const existing = this.conversations().find(c => c.userId === selection.conversationUserId);
      if (existing) {
        this.selectConversation(existing);
      } else {
        // New user selected from picker — create a stub conversation
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
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
    this.view.set('list');
    this.loadConversations();
    this.loadChannels();
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

  protected onMuteToggled(event: { channel: ChatRoom; mute: boolean }): void {
    this.chatService.muteChannel(event.channel.id, event.mute).subscribe(() => {
      this.loadChannels();
    });
  }

  protected onHeaderMuteToggled(mute: boolean): void {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.chatService.muteChannel(channel.id, mute).subscribe(() => {
      this.loadChannels();
    });
  }

  protected onMessageSent(content: string): void {
    const conv = this.selectedConversation();
    const channel = this.selectedChannel();
    const fileId = this.pendingFileAttachmentId() ?? undefined;

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
        },
      });
    }
  }

  protected onFileCancelled(): void {
    this.clearPendingFile();
  }

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

  ngOnDestroy(): void {
    if (this.hubConnected) {
      this.chatHub.disconnect();
    }
  }

  private clearPendingFile(): void {
    this.pendingFile.set(null);
    this.pendingFileAttachmentId.set(null);
  }

  private loadConversations(): void {
    this.chatService.getConversations().subscribe((convs) => {
      this.conversations.set(convs);
      this.updateUnreadCount();
    });
  }

  private loadChannels(): void {
    this.chatService.getChannels().subscribe((chs) => {
      this.channels.set(chs);
      this.updateUnreadCount();
    });
  }

  private updateUnreadCount(): void {
    const dmUnread = this.conversations().reduce((sum, c) => sum + c.unreadCount, 0);
    const chUnread = this.channels().reduce((sum, c) => sum + c.unreadCount, 0);
    this.totalUnread.set(dmUnread + chUnread);
  }

  private loadMessages(otherUserId: number): void {
    this.chatService.getMessages(otherUserId).subscribe((msgs) => {
      this.messages.set(msgs);
      this.messageArea()?.scrollToBottom();
    });
  }

  private loadChannelMessages(channelId: number): void {
    this.chatService.getChatRoomMessages(channelId).subscribe((msgs) => {
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
        this.messages.update((msgs) => {
          const updated = [...msgs, chatMessage];
          updated.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return updated;
        });
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
