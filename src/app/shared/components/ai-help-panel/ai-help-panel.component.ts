import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AiService, AiHelpMessage } from '../../services/ai.service';

@Component({
  selector: 'app-ai-help-panel',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, TranslatePipe],
  templateUrl: './ai-help-panel.component.html',
  styleUrl: './ai-help-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiHelpPanelComponent {
  private readonly aiService = inject(AiService);
  private readonly translate = inject(TranslateService);

  readonly messages = signal<AiHelpMessage[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);

  protected readonly inputControl = new FormControl('');

  protected readonly conversationHistory = computed(() =>
    this.messages().map(m => `${m.role}: ${m.content}`),
  );

  @ViewChild('messageContainer') private messageContainer?: ElementRef<HTMLDivElement>;

  toggle(): void {
    this.open.update(v => !v);
  }

  protected clearChat(): void {
    this.messages.set([]);
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

    const history = this.conversationHistory().slice(0, -1);

    this.aiService.ragHelpChat(question, history.length > 0 ? history : undefined).pipe(
      catchError(() => of(this.translate.instant('aiHelp.errorMessage'))),
    ).subscribe(answer => {
      const assistantMessage: AiHelpMessage = { role: 'assistant', content: answer };
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
