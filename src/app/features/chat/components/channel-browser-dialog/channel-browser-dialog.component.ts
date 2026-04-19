import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ChatService } from '../../services/chat.service';
import { ChatRoom } from '../../models/chat-room.model';

@Component({
  selector: 'app-channel-browser-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, DialogComponent, InputComponent],
  templateUrl: './channel-browser-dialog.component.html',
  styleUrl: './channel-browser-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelBrowserDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ChannelBrowserDialogComponent>);
  private readonly chatService = inject(ChatService);

  protected readonly searchControl = new FormControl('');
  protected readonly channels = signal<ChatRoom[]>([]);
  protected readonly loading = signal(false);
  protected readonly joiningId = signal<number | null>(null);

  protected readonly filteredChannels = computed(() => {
    const term = (this.searchControl.value ?? '').toLowerCase();
    if (!term) return this.channels();
    return this.channels().filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.description?.toLowerCase().includes(term) ?? false),
    );
  });

  constructor() {
    this.loadChannels();
    this.searchControl.valueChanges.subscribe(() => {
      this.loadChannels(this.searchControl.value ?? undefined);
    });
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

  protected joinChannel(channel: ChatRoom): void {
    if (this.joiningId()) return;
    this.joiningId.set(channel.id);
    this.chatService.joinChannel(channel.id).subscribe({
      next: () => {
        this.joiningId.set(null);
        this.dialogRef.close(channel);
      },
      error: () => {
        this.joiningId.set(null);
      },
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private loadChannels(search?: string): void {
    this.loading.set(true);
    this.chatService.discoverChannels(search).subscribe({
      next: (channels) => {
        this.channels.set(channels);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
