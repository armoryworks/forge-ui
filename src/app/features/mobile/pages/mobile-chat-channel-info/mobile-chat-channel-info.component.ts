import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatService } from '../../../chat/services/chat.service';
import { ChatRoom, ChatRoomMember } from '../../../chat/models/chat-room.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-mobile-chat-channel-info',
  standalone: true,
  imports: [DatePipe, AvatarComponent, TranslatePipe],
  templateUrl: './mobile-chat-channel-info.component.html',
  styleUrl: './mobile-chat-channel-info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileChatChannelInfoComponent implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly channel = signal<ChatRoom | null>(null);
  protected readonly loading = signal(false);
  protected readonly isMuted = signal(false);

  protected readonly currentUserId = this.authService.user()?.id;

  ngOnInit(): void {
    const channelId = Number(this.route.snapshot.paramMap.get('channelId'));
    if (!channelId) {
      this.goBack();
      return;
    }
    this.loadChannel(channelId);
  }

  protected goBack(): void {
    this.router.navigate(['../../chat'], { relativeTo: this.route });
  }

  protected getChannelIcon(channel: ChatRoom): string {
    if (channel.iconName) return channel.iconName;
    switch (channel.channelType) {
      case 'System': return 'forum';
      case 'Broadcast': return 'campaign';
      case 'TeamAuto': return 'group';
      case 'Custom': return 'tag';
      case 'DirectMessage': return 'person';
      default: return 'chat';
    }
  }

  protected getChannelTypeLabel(channel: ChatRoom): string {
    switch (channel.channelType) {
      case 'Group': return 'Group Channel';
      case 'TeamAuto': return 'Team Channel';
      case 'System': return 'System Channel';
      case 'Broadcast': return 'Broadcast Channel';
      case 'Custom': return 'Custom Channel';
      case 'DirectMessage': return 'Direct Message';
      default: return 'Channel';
    }
  }

  protected toggleMute(): void {
    const ch = this.channel();
    if (!ch) return;

    const newMuted = !this.isMuted();
    this.chatService.muteChannel(ch.id, newMuted).subscribe({
      next: () => {
        this.isMuted.set(newMuted);
        this.snackbar.info(newMuted ? 'Channel muted' : 'Channel unmuted');
      },
    });
  }

  protected leaveChannel(): void {
    const ch = this.channel();
    if (!ch) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Leave Channel?',
        message: `Are you sure you want to leave #${ch.name}? You can rejoin later.`,
        confirmLabel: 'Leave',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.chatService.leaveChannel(ch.id).subscribe({
          next: () => {
            this.snackbar.info(`Left #${ch.name}`);
            this.router.navigate(['../../chat'], { relativeTo: this.route });
          },
        });
      }
    });
  }

  protected isOwnMember(member: ChatRoomMember): boolean {
    return member.userId === this.currentUserId;
  }

  protected getRoleBadge(role: string): string {
    switch (role) {
      case 'Owner': return 'Owner';
      case 'Admin': return 'Admin';
      default: return '';
    }
  }

  private loadChannel(channelId: number): void {
    this.loading.set(true);
    // Load channel from state or refetch channels list
    const state = history.state?.channel as ChatRoom | undefined;
    if (state && state.id === channelId) {
      this.channel.set(state);
      this.initMuteState(state);
      this.loading.set(false);
    } else {
      this.chatService.getChannels().subscribe({
        next: (channels) => {
          const found = channels.find(c => c.id === channelId);
          if (found) {
            this.channel.set(found);
            this.initMuteState(found);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.goBack();
        },
      });
    }
  }

  private initMuteState(channel: ChatRoom): void {
    const currentMember = channel.members.find(m => m.userId === this.currentUserId);
    this.isMuted.set(currentMember?.isMuted ?? false);
  }
}
