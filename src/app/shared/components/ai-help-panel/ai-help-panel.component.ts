import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AiService, AiHelpMessage } from '../../services/ai.service';

@Component({
  selector: 'app-ai-help-panel',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './ai-help-panel.component.html',
  styleUrl: './ai-help-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiHelpPanelComponent {
  private readonly aiService = inject(AiService);

  readonly messages = signal<AiHelpMessage[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);

  protected readonly inputControl = new FormControl('');

  @ViewChild('messageContainer') private messageContainer?: ElementRef<HTMLDivElement>;

  toggle(): void {
    this.open.update(v => !v);
  }

  protected askStarter(question: string): void {
    this.inputControl.setValue(question);
    this.send();
  }

  protected send(): void {
    const question = this.inputControl.value?.trim();
    if (!question || this.loading()) {
      return;
    }

    this.inputControl.setValue('');

    const userMessage: AiHelpMessage = { role: 'user', content: question };
    this.messages.update(msgs => [...msgs, userMessage]);
    this.loading.set(true);
    this.scrollToBottom();

    const history = this.messages().slice(0, -1);

    this.aiService.helpChat(question, history).pipe(
      catchError(() => of({ answer: 'Sorry, I was unable to process your question. Please try again.' })),
    ).subscribe(response => {
      const assistantMessage: AiHelpMessage = { role: 'assistant', content: response.answer };
      this.messages.update(msgs => [...msgs, assistantMessage]);
      this.loading.set(false);
      this.scrollToBottom();
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.messageContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}
