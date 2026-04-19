import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { ChatBroadcastService } from '../../services/chat-broadcast.service';
import { ChatHubService } from '../../../../shared/services/chat-hub.service';
import { ChatService } from '../../services/chat.service';
import { ChatConversation } from '../../models/chat-conversation.model';
import { ChatMessage } from '../../models/chat-message.model';
import { ChatMessageEvent } from '../../models/chat-message-event.model';
import { ChatRoom } from '../../models/chat-room.model';
import { CreateChannelDialogComponent } from '../create-channel-dialog/create-channel-dialog.component';
import { ChannelBrowserDialogComponent } from '../channel-browser-dialog/channel-browser-dialog.component';
import { ChannelSettingsDialogComponent, ChannelSettingsDialogData, ChannelSettingsDialogResult } from '../channel-settings-dialog/channel-settings-dialog.component';
import { ChatChannelListComponent, ChannelSelection } from '../chat-channel-list/chat-channel-list.component';
import { ChatMessageAreaComponent } from '../chat-message-area/chat-message-area.component';
import { ChatChannelHeaderComponent } from '../chat-channel-header/chat-channel-header.component';
import { ChatThreadPanelComponent } from '../chat-thread-panel/chat-thread-panel.component';

@Component({
  selector: 'app-chat-popout',
  standalone: true,
  imports: [TranslatePipe, ChatChannelListComponent, ChatMessageAreaComponent, ChatChannelHeaderComponent, ChatThreadPanelComponent],
  templateUrl: './chat-popout.component.html',
  styleUrl: './chat-popout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPopoutComponent implements OnInit, OnDestroy {
  private readonly chatBroadcast = inject(ChatBroadcastService);
  private readonly chatService = inject(ChatService);
  private readonly chatHub = inject(ChatHubService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  private readonly messageArea = viewChild<ChatMessageAreaComponent>('messageArea');

  protected readonly conversations = signal<ChatConversation[]>([]);
  protected readonly channels = signal<ChatRoom[]>([]);
  protected readonly selectedConversation = signal<ChatConversation | null>(null);
  protected readonly selectedChannel = signal<ChatRoom | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);

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
  protected readonly hasSelection = computed(() => this.selectedConversation() !== null || this.selectedChannel() !== null);
  protected readonly isChannel = computed(() => this.selectedChannel() !== null);
  protected readonly isReadOnly = computed(() => this.selectedChannel()?.isReadOnly ?? false);

  protected readonly headerTitle = computed(() => {
    const conv = this.selectedConversation();
    if (conv) return conv.userName;
    const ch = this.selectedChannel();
    if (ch) return ch.name;
    return '';
  });

  private hubConnected = false;

  ngOnInit(): void {
    this.chatBroadcast.send({ type: 'windowOpened' });
    window.addEventListener('beforeunload', this.onBeforeUnload);

    this.loadConversations();
    this.loadChannels();
    this.connectHub();
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    if (this.hubConnected) {
      this.chatHub.disconnect();
    }
  }

  protected onChannelSelected(selection: ChannelSelection): void {
    if (selection.type === 'dm' && selection.conversationUserId != null) {
      const existing = this.conversations().find(c => c.userId === selection.conversationUserId);
      if (existing) {
        this.selectConversation(existing);
      } else {
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
        this.deselectAll();
      } else if (result === 'updated') {
        this.loadChannels();
      }
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

  private selectConversation(conv: ChatConversation): void {
    this.selectedConversation.set(conv);
    this.selectedChannel.set(null);
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
    this.loadMessages(conv.userId);
    this.chatService.markAsRead(conv.userId).subscribe();
  }

  private selectChannel(channel: ChatRoom): void {
    this.selectedChannel.set(channel);
    this.selectedConversation.set(null);
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
    this.loadChannelMessages(channel.id);
    this.chatService.markChannelRead(channel.id).subscribe();
    this.chatHub.joinChannel(channel.id);
  }

  private deselectAll(): void {
    const ch = this.selectedChannel();
    if (ch) this.chatHub.leaveChannel(ch.id);
    this.selectedConversation.set(null);
    this.selectedChannel.set(null);
    this.messages.set([]);
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
    this.loadConversations();
    this.loadChannels();
  }

  private clearPendingFile(): void {
    this.pendingFile.set(null);
    this.pendingFileAttachmentId.set(null);
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

  private onBeforeUnload = (): void => {
    this.chatBroadcast.send({ type: 'windowClosed' });
  };
}
