import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { TranslatePipe } from '@ngx-translate/core';
import { MentionRenderPipe } from '../../../chat/pipes/mention-render.pipe';
import { ChatService } from '../../../chat/services/chat.service';
import { ChatMessage } from '../../../chat/models/chat-message.model';
import { AuthService } from '../../../../shared/services/auth.service';

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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly parentMessage = signal<ChatMessage | null>(null);
  protected readonly replies = signal<ChatMessage[]>([]);
  protected readonly loading = signal(false);
  protected readonly replyControl = new FormControl('');
  protected readonly sending = signal(false);

  ngOnInit(): void {
    const messageId = Number(this.route.snapshot.paramMap.get('messageId'));
    if (!messageId) {
      this.goBack();
      return;
    }
    this.loadThread(messageId);
  }

  protected goBack(): void {
    this.router.navigate(['../../chat'], { relativeTo: this.route });
  }

  protected isOwnMessage(msg: ChatMessage): boolean {
    return msg.senderId === this.authService.user()?.id;
  }

  protected formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected sendReply(): void {
    const content = this.replyControl.value?.trim();
    const parent = this.parentMessage();
    if (!content || !parent) return;

    this.sending.set(true);
    this.chatService.replyInThread(parent.id, content).subscribe({
      next: (reply) => {
        this.replies.update(r => [...r, reply]);
        this.replyControl.setValue('');
        this.sending.set(false);
      },
      error: () => this.sending.set(false),
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendReply();
    }
  }

  protected getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    return 'attach_file';
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private loadThread(messageId: number): void {
    this.loading.set(true);
    this.chatService.getThread(messageId).subscribe({
      next: (replies) => {
        if (replies.length > 0) {
          // The first element may be the parent or all replies
          // We try to find the parent from the replies context
          this.replies.set(replies);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.goBack();
      },
    });

    // Load parent message by fetching thread — the parent info is passed via state
    const nav = this.router.getCurrentNavigation();
    const parentMsg = nav?.extras?.state?.['parentMessage'] as ChatMessage | undefined;
    if (parentMsg) {
      this.parentMessage.set(parentMsg);
    } else {
      // Fallback: get from history state
      const state = history.state?.parentMessage as ChatMessage | undefined;
      if (state) {
        this.parentMessage.set(state);
      }
    }
  }
}
