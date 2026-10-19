import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';

import { MatDialog } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { CapabilityService } from '../../../shared/services/capability.service';
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
import { NewMessageDialogComponent, NewMessageRecipient } from '../../chat/components/new-message-dialog/new-message-dialog.component';
import { mutedChannelIds } from '../../chat/utils/chat-rooms';

type MobileChatView = 'list' | 'dm' | 'channel';

interface ChatRouteTarget {
  dm: number | null;
  channel: number | null;
}

@Component({
  selector: 'app-mobile-chat',
  standalone: true,
  imports: [A11yModule, TranslatePipe, ChatChannelListComponent, ChatMessageAreaComponent, ChatChannelHeaderComponent, ChatThreadPanelComponent],
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
  private readonly translate = inject(TranslateService);
  private readonly location = inject(Location);
  private readonly http = inject(HttpClient);
  private readonly capabilities = inject(CapabilityService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly messageArea = viewChild<ChatMessageAreaComponent>('messageArea');
  private readonly threadPanel = viewChild(ChatThreadPanelComponent);

  protected readonly view = signal<MobileChatView>('list');
  protected readonly conversations = signal<ChatConversation[]>([]);
  protected readonly channels = signal<ChatRoom[]>([]);
  protected readonly selectedConversation = signal<ChatConversation | null>(null);
  protected readonly selectedChannel = signal<ChatRoom | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly searchTerm = signal('');

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
  protected readonly mutedChannelIds = computed(() => mutedChannelIds(this.channels(), this.currentUserId()));
  protected readonly canStartDirectMessage = computed(() => this.capabilities.isEnabled('CAP-IDEN-USERS', true));

  // Swipe state (mobile-specific)
  protected readonly swipedChannelId = signal<number | null>(null);

  // Pull-to-refresh
  protected readonly refreshing = signal(false);

  private hubConnected = false;
  private conversationsLoaded = false;
  private channelsLoaded = false;
  private openedFromList = false;
  private target: ChatRouteTarget = { dm: null, channel: null };
  private knownConversation: ChatConversation | null = null;
  private knownChannel: ChatRoom | null = null;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.target = this.parseTarget(params);
      this.applyTarget();
    });
    this.loadConversations();
    this.loadChannels();
    this.connectHub();
  }

  // ── Channel list events ──

  protected onChannelSelected(selection: ChannelSelection): void {
    if (selection.type === 'dm' && selection.conversationUserId != null) {
      this.openConversation({ dm: selection.conversationUserId, channel: null });
    } else if (selection.type === 'channel' && selection.channelId != null) {
      this.openConversation({ dm: null, channel: selection.channelId });
    }
  }

  protected openNewMessage(): void {
    this.dialog.open<NewMessageDialogComponent, void, NewMessageRecipient>(NewMessageDialogComponent, { width: '420px' })
      .afterClosed().subscribe(user => {
        if (!user) return;
        this.knownConversation = this.conversations().find(c => c.userId === user.id) ?? this.toConversation(user);
        this.openConversation({ dm: user.id, channel: null });
      });
  }

  protected onMuteToggled(event: { channel: ChatRoom; mute: boolean }): void {
    this.chatService.muteChannel(event.channel.id, event.mute).subscribe(() => {
      this.snackbar.info(this.translate.instant(
        event.mute ? 'mobileLegacyPages.chat.muted' : 'mobileLegacyPages.chat.unmuted',
        { name: event.channel.name },
      ));
      this.loadChannels();
    });
  }

  protected onHeaderMuteToggled(mute: boolean): void {
    const channel = this.selectedChannel();
    if (!channel) return;
    this.chatService.muteChannel(channel.id, mute).subscribe(() => {
      this.snackbar.info(this.translate.instant(
        mute ? 'mobileLegacyPages.chat.muted' : 'mobileLegacyPages.chat.unmuted',
        { name: channel.name },
      ));
      this.loadChannels();
    });
  }

  // ── Navigation ──

  protected backToList(): void {
    if (this.openedFromList) {
      this.location.back();
    } else {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  // ── Dialogs ──

  protected openCreateChannel(): void {
    this.dialog.open(CreateChannelDialogComponent, { width: '520px' })
      .afterClosed().subscribe((result: ChatRoom | undefined) => {
        if (result) {
          this.knownChannel = result;
          this.loadChannels();
          this.openConversation({ dm: null, channel: result.id });
        }
      });
  }

  protected openBrowseChannels(): void {
    this.dialog.open(ChannelBrowserDialogComponent, { width: '520px' })
      .afterClosed().subscribe((result: ChatRoom | undefined) => {
        if (result) {
          this.knownChannel = result;
          this.loadChannels();
          this.openConversation({ dm: null, channel: result.id });
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
      this.uploadAndSend(content, channel);
      return;
    }

    const onSent = (msg: ChatMessage) => {
      this.messages.update((msgs) => [...msgs, msg]);
      this.clearPendingFile();
      this.messageArea()?.clearComposer();
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
        error: (err: unknown) => {
          this.pendingFile.set(null);
          this.isUploading.set(false);
          this.snackbar.errorFrom(err, 'mobileLegacyPages.chat.uploadFailed');
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
      this.threadPanel()?.clearComposer();
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

  private parseTarget(params: ParamMap): ChatRouteTarget {
    const id = (key: string) => {
      const value = Number(params.get(key));
      return Number.isInteger(value) && value > 0 ? value : null;
    };
    const channel = id('channel');
    return { channel, dm: channel ? null : id('dm') };
  }

  private openConversation(target: ChatRouteTarget): void {
    const fromList = this.view() === 'list';
    if (fromList) this.openedFromList = true;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: target.channel ? { channel: target.channel } : { dm: target.dm },
      replaceUrl: !fromList,
    });
  }

  private applyTarget(): void {
    const { dm, channel } = this.target;
    if (channel) {
      if (this.selectedChannel()?.id === channel) return;
      const found = this.channels().find(c => c.id === channel)
        ?? (this.knownChannel?.id === channel ? this.knownChannel : null);
      if (found) {
        this.selectChannel(found);
      } else if (this.channelsLoaded) {
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
      return;
    }
    if (dm) {
      if (this.selectedConversation()?.userId === dm) return;
      const found = this.conversations().find(c => c.userId === dm)
        ?? (this.knownConversation?.userId === dm ? this.knownConversation : null);
      if (found) {
        this.selectConversation(found);
      } else if (this.conversationsLoaded) {
        this.selectConversation(this.toConversation({ id: dm, name: '', initials: '', color: '' }));
        this.resolveConversationUser(dm);
      }
      return;
    }
    if (this.view() !== 'list') this.showList();
  }

  private showList(): void {
    const ch = this.selectedChannel();
    if (ch) this.chatHub.leaveChannel(ch.id);
    this.openedFromList = false;
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

  private toConversation(user: NewMessageRecipient): ChatConversation {
    return {
      userId: user.id,
      userName: user.name,
      userInitials: user.initials,
      userColor: user.color,
      lastMessage: null,
      lastMessageAt: null,
      unreadCount: 0,
    };
  }

  private resolveConversationUser(userId: number): void {
    if (!this.canStartDirectMessage()) return;
    this.http.get<NewMessageRecipient[]>('/api/v1/users').pipe(
      catchError(() => of([] as NewMessageRecipient[])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(users => {
      const user = users.find(u => u.id === userId);
      if (user && this.selectedConversation()?.userId === userId) {
        this.selectedConversation.set(this.toConversation(user));
      }
    });
  }

  private selectConversation(conv: ChatConversation): void {
    const previous = this.selectedChannel();
    if (previous) this.chatHub.leaveChannel(previous.id);
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
    this.clearPendingFile();
    this.selectedConversation.set(conv);
    this.selectedChannel.set(null);
    this.view.set('dm');
    this.loadMessages(conv.userId);
    this.chatService.markAsRead(conv.userId).subscribe();
  }

  private selectChannel(channel: ChatRoom): void {
    const previous = this.selectedChannel();
    if (previous && previous.id !== channel.id) this.chatHub.leaveChannel(previous.id);
    this.threadParentMessage.set(null);
    this.threadReplies.set([]);
    this.clearPendingFile();
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

  private uploadAndSend(content: string, channel: ChatRoom | null): void {
    const file = this.pendingFile();
    if (!file || !channel) return;

    this.isUploading.set(true);
    this.chatService.uploadChatFile(channel.id, file).subscribe({
      next: (attachment) => {
        this.isUploading.set(false);
        this.pendingFileAttachmentId.set(attachment.id);
        this.chatService.sendChatRoomMessage(channel.id, content, attachment.id).subscribe((msg) => {
          this.messages.update(msgs => [...msgs, msg]);
          this.clearPendingFile();
          this.messageArea()?.clearComposer();
          this.messageArea()?.scrollToBottom();
        });
      },
      error: (err: unknown) => {
        this.isUploading.set(false);
        this.snackbar.errorFrom(err, 'mobileLegacyPages.chat.uploadFailed');
      },
    });
  }

  private loadConversations(): void {
    this.chatService.getConversations().subscribe((convs) => {
      this.conversations.set(convs);
      this.conversationsLoaded = true;
      this.applyTarget();
    });
  }

  private loadChannels(): void {
    this.chatService.getChannels().subscribe((chs) => {
      this.channels.set(chs);
      this.channelsLoaded = true;
      this.applyTarget();
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
