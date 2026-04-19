import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ChatConversation } from '../../models/chat-conversation.model';
import { ChatRoom } from '../../models/chat-room.model';

@Component({
  selector: 'app-chat-channel-header',
  standalone: true,
  imports: [MatTooltipModule, AvatarComponent, TranslatePipe],
  templateUrl: './chat-channel-header.component.html',
  styleUrl: './chat-channel-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatChannelHeaderComponent {
  private readonly authService = inject(AuthService);

  readonly conversation = input<ChatConversation | null>(null);
  readonly channel = input<ChatRoom | null>(null);
  readonly showBack = input(true);
  readonly showPopout = input(false);
  readonly showClose = input(false);

  readonly backClicked = output<void>();
  readonly settingsClicked = output<void>();
  readonly muteToggled = output<boolean>();
  readonly popoutClicked = output<void>();
  readonly closeClicked = output<void>();

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

  protected get memberCount(): number {
    return this.channel()?.members?.length ?? 0;
  }

  protected get isChannelMuted(): boolean {
    const ch = this.channel();
    if (!ch) return false;
    const currentMember = ch.members.find(m => m.userId === this.authService.user()?.id);
    return currentMember?.isMuted ?? false;
  }

  protected onBack(): void {
    this.backClicked.emit();
  }

  protected onSettings(): void {
    this.settingsClicked.emit();
  }

  protected onMuteToggle(): void {
    this.muteToggled.emit(!this.isChannelMuted);
  }

  protected onPopout(): void {
    this.popoutClicked.emit();
  }

  protected onClose(): void {
    this.closeClicked.emit();
  }
}
