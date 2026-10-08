import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
  private readonly translate = inject(TranslateService);

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

  protected getChannelTypeLabelKey(channel: ChatRoom): string {
    switch (channel.channelType) {
      case 'Group': return 'mobileLegacyPages.channelInfo.typeGroup';
      case 'TeamAuto': return 'mobileLegacyPages.channelInfo.typeTeam';
      case 'System': return 'mobileLegacyPages.channelInfo.typeSystem';
      case 'Broadcast': return 'mobileLegacyPages.channelInfo.typeBroadcast';
      case 'Custom': return 'mobileLegacyPages.channelInfo.typeCustom';
      case 'DirectMessage': return 'mobileLegacyPages.channelInfo.typeDirectMessage';
      default: return 'mobileLegacyPages.channelInfo.typeChannel';
    }
  }

  protected toggleMute(): void {
    const ch = this.channel();
    if (!ch) return;

    const newMuted = !this.isMuted();
    this.chatService.muteChannel(ch.id, newMuted).subscribe({
      next: () => {
        this.isMuted.set(newMuted);
        this.snackbar.info(this.translate.instant(newMuted ? 'mobileLegacyPages.channelInfo.channelMuted' : 'mobileLegacyPages.channelInfo.channelUnmuted'));
      },
    });
  }

  protected leaveChannel(): void {
    const ch = this.channel();
    if (!ch) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('mobileLegacyPages.channelInfo.leaveTitle'),
        message: this.translate.instant('mobileLegacyPages.channelInfo.leaveMessage', { name: ch.name }),
        confirmLabel: this.translate.instant('mobileLegacyPages.channelInfo.leaveConfirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.chatService.leaveChannel(ch.id).subscribe({
          next: () => {
            this.snackbar.info(this.translate.instant('mobileLegacyPages.channelInfo.left', { name: ch.name }));
            this.router.navigate(['../../chat'], { relativeTo: this.route });
          },
        });
      }
    });
  }

  protected isOwnMember(member: ChatRoomMember): boolean {
    return member.userId === this.currentUserId;
  }

  protected getRoleBadgeKey(role: string): string {
    switch (role) {
      case 'Owner': return 'mobileLegacyPages.channelInfo.roleOwner';
      case 'Admin': return 'mobileLegacyPages.channelInfo.roleAdmin';
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
