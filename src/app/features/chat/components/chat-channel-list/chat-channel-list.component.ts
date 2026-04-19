import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ChatConversation } from '../../models/chat-conversation.model';
import { ChatRoom } from '../../models/chat-room.model';
import { formatDate } from '../../../../shared/utils/date.utils';
import { TranslateService } from '@ngx-translate/core';

interface UserListItem {
  id: number;
  initials: string;
  name: string;
  color: string;
}

export interface ChannelSelection {
  type: 'dm' | 'channel';
  conversationUserId?: number;
  channelId?: number;
}

@Component({
  selector: 'app-chat-channel-list',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, AvatarComponent, TranslatePipe],
  templateUrl: './chat-channel-list.component.html',
  styleUrl: './chat-channel-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatChannelListComponent {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);

  readonly conversations = input<ChatConversation[]>([]);
  readonly channels = input<ChatRoom[]>([]);
  readonly selectedChannelId = input<number | null>(null);
  readonly selectedUserId = input<number | null>(null);
  readonly compact = input(false);

  readonly channelSelected = output<ChannelSelection>();
  readonly newMessage = output<void>();
  readonly newGroup = output<void>();
  readonly browseChannels = output<void>();
  readonly muteToggled = output<{ channel: ChatRoom; mute: boolean }>();

  protected readonly view = signal<'list' | 'userPicker'>('list');
  protected readonly channelSectionsExpanded = signal<Record<string, boolean>>({
    dms: true,
    channels: true,
    teams: true,
  });

  // User picker state
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

  // Computed channel groups
  protected readonly groupChannels = computed(() =>
    this.channels().filter(c => c.channelType === 'Group' || c.channelType === 'Custom' || c.channelType === 'System' || c.channelType === 'Broadcast'));
  protected readonly teamChannels = computed(() =>
    this.channels().filter(c => c.channelType === 'TeamAuto'));

  protected toggleSection(section: string): void {
    this.channelSectionsExpanded.update(s => ({ ...s, [section]: !s[section] }));
  }

  protected selectConversation(conv: ChatConversation): void {
    this.channelSelected.emit({ type: 'dm', conversationUserId: conv.userId });
  }

  protected selectChannel(channel: ChatRoom): void {
    this.channelSelected.emit({ type: 'channel', channelId: channel.id });
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
    this.userSearchControl.valueChanges.subscribe(v => this.userSearchTerm.set(v ?? ''));
  }

  protected selectUser(user: UserListItem): void {
    this.view.set('list');
    this.channelSelected.emit({ type: 'dm', conversationUserId: user.id });
    this.newMessage.emit();
  }

  protected cancelUserPicker(): void {
    this.view.set('list');
  }

  protected onNewGroup(): void {
    this.newGroup.emit();
  }

  protected onBrowseChannels(): void {
    this.browseChannels.emit();
  }

  protected toggleMuteChannel(channel: ChatRoom, event: Event): void {
    event.stopPropagation();
    const currentMember = channel.members.find(m => m.userId === this.authService.user()?.id);
    const isMuted = currentMember?.isMuted ?? false;
    this.muteToggled.emit({ channel, mute: !isMuted });
  }

  protected isChannelMuted(channel: ChatRoom): boolean {
    const currentMember = channel.members.find(m => m.userId === this.authService.user()?.id);
    return currentMember?.isMuted ?? false;
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
}
