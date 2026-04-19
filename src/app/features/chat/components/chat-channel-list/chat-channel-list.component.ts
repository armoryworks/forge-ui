import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatTooltipModule } from '@angular/material/tooltip';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { formatDate } from '../../../../shared/utils/date.utils';
import { ChatConversation } from '../../models/chat-conversation.model';
import { ChatRoom } from '../../models/chat-room.model';

export interface ChannelSelection {
  type: 'dm' | 'channel';
  channelId?: number;
  conversationUserId?: number;
}

@Component({
  selector: 'app-chat-channel-list',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, TranslatePipe, AvatarComponent, InputComponent],
  templateUrl: './chat-channel-list.component.html',
  styleUrl: './chat-channel-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatChannelListComponent {
  private readonly translate = inject(TranslateService);

  // Inputs
  readonly conversations = input<ChatConversation[]>([]);
  readonly rooms = input<ChatRoom[]>([]);
  readonly channels = input<ChatRoom[]>([]); // alias for rooms
  readonly selectedId = input<number | null>(null);
  readonly selectedType = input<'dm' | 'channel' | null>(null);
  readonly selectedChannelId = input<number | null>(null);
  readonly selectedUserId = input<number | null>(null);
  readonly searchTerm = input<string>('');
  readonly mutedChannelIds = input<Set<number>>(new Set());

  // Outputs
  readonly conversationSelected = output<ChatConversation>();
  readonly roomSelected = output<ChatRoom>();
  readonly channelSelected = output<ChannelSelection>();
  readonly newMessageClicked = output<void>();
  readonly newGroupClicked = output<void>();
  readonly newGroup = output<void>(); // alias
  readonly browseChannelsClicked = output<void>();
  readonly browseChannels = output<void>(); // alias
  readonly muteToggled = output<{ channel: ChatRoom; mute: boolean }>();
  readonly searchChanged = output<string>();

  // Internal state
  readonly searchControl = new FormControl('');
  protected readonly sectionsExpanded = signal<Record<string, boolean>>({
    dms: true,
    channels: true,
    teams: true,
  });

  // Merge rooms + channels inputs
  private readonly allRooms = computed(() => {
    const r = this.rooms();
    const c = this.channels();
    return r.length > 0 ? r : c;
  });

  // Computed channel groups
  protected readonly groupChannels = computed(() =>
    this.allRooms().filter(c =>
      c.channelType === 'Group' || c.channelType === 'Custom' || c.channelType === 'System' || c.channelType === 'Broadcast',
    ),
  );

  protected readonly teamChannels = computed(() =>
    this.allRooms().filter(c => c.channelType === 'TeamAuto'),
  );

  // Filtered lists based on search
  protected readonly filteredConversations = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.conversations();
    return this.conversations().filter(c => c.userName.toLowerCase().includes(term));
  });

  protected readonly filteredGroupChannels = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.groupChannels();
    return this.groupChannels().filter(c => c.name.toLowerCase().includes(term));
  });

  protected readonly filteredTeamChannels = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.teamChannels();
    return this.teamChannels().filter(c => c.name.toLowerCase().includes(term));
  });

  protected readonly hasResults = computed(() =>
    this.filteredConversations().length > 0
    || this.filteredGroupChannels().length > 0
    || this.filteredTeamChannels().length > 0,
  );

  constructor() {
    this.searchControl.valueChanges.subscribe(v => {
      this.searchChanged.emit(v ?? '');
    });
  }

  protected toggleSection(section: string): void {
    this.sectionsExpanded.update(s => ({ ...s, [section]: !s[section] }));
  }

  protected isActive(type: 'dm' | 'channel', id: number): boolean {
    return this.selectedType() === type && this.selectedId() === id;
  }

  protected isChannelMuted(channel: ChatRoom): boolean {
    return this.mutedChannelIds().has(channel.id);
  }

  protected onMuteToggle(channel: ChatRoom, event: Event): void {
    event.stopPropagation();
    this.muteToggled.emit({ channel, mute: !this.isChannelMuted(channel) });
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

  protected formatTimestamp(date: Date | string | null): string {
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
