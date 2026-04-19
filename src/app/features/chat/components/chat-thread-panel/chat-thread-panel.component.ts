import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ChatMessage } from '../../models/chat-message.model';
import { MentionRenderPipe } from '../../pipes/mention-render.pipe';

@Component({
  selector: 'app-chat-thread-panel',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent, MentionRenderPipe],
  templateUrl: './chat-thread-panel.component.html',
  styleUrl: './chat-thread-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatThreadPanelComponent {
  private readonly authService = inject(AuthService);

  readonly parentMessage = input.required<ChatMessage>();
  readonly replies = input<ChatMessage[]>([]);

  readonly replySent = output<string>();
  readonly closed = output<void>();

  protected readonly replyControl = new FormControl('');

  protected sendReply(): void {
    const content = this.replyControl.value?.trim();
    if (!content) return;
    this.replySent.emit(content);
    this.replyControl.setValue('');
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendReply();
    }
  }

  protected isOwnMessage(msg: ChatMessage): boolean {
    return msg.senderId === this.authService.user()?.id;
  }

  protected formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected onClose(): void {
    this.closed.emit();
  }
}
