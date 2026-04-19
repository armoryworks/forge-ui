import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ChatService } from '../../../chat/services/chat.service';
import { ChatMessage } from '../../../chat/models/chat-message.model';
import { MentionRenderPipe } from '../../../chat/pipes/mention-render.pipe';

@Component({
  selector: 'app-mobile-chat-thread',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent, TranslatePipe, MentionRenderPipe],
  templateUrl: './mobile-chat-thread.component.html',
  styleUrl: './mobile-chat-thread.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileChatThreadComponent implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);

  private readonly repliesContainer = viewChild<ElementRef<HTMLElement>>('repliesContainer');

  readonly parentMessage = input.required<ChatMessage>();
  readonly closed = output<void>();
  readonly replyAdded = output<{ parentMessageId: number; replyCount: number }>();

  protected readonly replies = signal<ChatMessage[]>([]);
  protected readonly replyControl = new FormControl('');
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);

  protected readonly replyCount = computed(() => this.replies().length);

  protected readonly uniqueParticipants = computed(() => {
    const parent = this.parentMessage();
    const participantMap = new Map<number, { initials: string; color: string }>();

    participantMap.set(parent.senderId, {
      initials: parent.senderInitials,
      color: parent.senderColor,
    });

    for (const reply of this.replies()) {
      if (!participantMap.has(reply.senderId)) {
        participantMap.set(reply.senderId, {
          initials: reply.senderInitials,
          color: reply.senderColor,
        });
      }
    }

    return Array.from(participantMap.values());
  });

  ngOnInit(): void {
    this.loadReplies();
  }

  protected isOwnMessage(msg: ChatMessage): boolean {
    return msg.senderId === this.authService.user()?.id;
  }

  protected formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendReply();
    }
  }

  protected sendReply(): void {
    const content = this.replyControl.value?.trim();
    if (!content || this.sending()) return;

    this.sending.set(true);
    this.chatService.replyInThread(this.parentMessage().id, content).subscribe({
      next: (reply) => {
        this.replies.update(r => [...r, reply]);
        this.replyControl.setValue('');
        this.sending.set(false);
        this.replyAdded.emit({
          parentMessageId: this.parentMessage().id,
          replyCount: this.replies().length,
        });
        this.scrollToBottom();
      },
      error: () => {
        this.sending.set(false);
      },
    });
  }

  protected onBack(): void {
    this.closed.emit();
  }

  private loadReplies(): void {
    this.loading.set(true);
    this.chatService.getThread(this.parentMessage().id).subscribe({
      next: (replies) => {
        this.replies.set(replies);
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  /** Called by parent when a SignalR thread reply arrives for this thread. */
  addReply(reply: ChatMessage): void {
    this.replies.update(r => [...r, reply]);
    this.replyAdded.emit({
      parentMessageId: this.parentMessage().id,
      replyCount: this.replies().length,
    });
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.repliesContainer()?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}
