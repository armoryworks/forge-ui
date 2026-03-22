import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MatTooltipModule } from '@angular/material/tooltip';
import { MarkdownComponent } from 'ngx-markdown';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AiHelpMessage, AiService } from '../../services/ai.service';
import { AuthService } from '../../services/auth.service';

const MAX_STORED_MESSAGES = 50;

@Component({
  selector: 'app-ai-help-panel',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, MarkdownComponent, TranslatePipe],
  templateUrl: './ai-help-panel.component.html',
  styleUrl: './ai-help-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiHelpPanelComponent implements OnInit, OnDestroy {
  private readonly aiService = inject(AiService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  readonly messages = signal<AiHelpMessage[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  readonly streamingContent = signal<string>('');

  protected readonly inputControl = new FormControl('');

  @ViewChild('messageContainer') private messageContainer?: ElementRef<HTMLDivElement>;

  private storageKey = '';
  private streamSubscription?: Subscription;

  private readonly onStorageEvent = (e: StorageEvent) => {
    if (e.key === this.storageKey && e.newValue !== null) {
      try {
        this.messages.set(JSON.parse(e.newValue));
      } catch {
        // malformed — ignore
      }
    }
  };

  ngOnInit(): void {
    const userId = this.auth.user()?.id;
    this.storageKey = `ai-help:${userId ?? 'anon'}`;
    this.messages.set(this.loadFromStorage());
    window.addEventListener('storage', this.onStorageEvent);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorageEvent);
    this.streamSubscription?.unsubscribe();
  }

  toggle(): void {
    this.open.update(v => !v);
  }

  protected clearChat(): void {
    this.messages.set([]);
    localStorage.removeItem(this.storageKey);
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
    this.streamingContent.set('');
    this.scrollToBottom();

    const history = this.messages().slice(0, -1);

    this.streamSubscription = this.aiService
      .streamHelpChat(question, history.length > 0 ? history : undefined)
      .subscribe({
        next: (token) => {
          this.streamingContent.update(current => current + token);
          this.scrollToBottom();
        },
        error: () => {
          // Fallback: if streaming fails, push whatever we accumulated (or error message)
          const accumulated = this.streamingContent();
          const content = accumulated || this.translate.instant('aiHelp.errorMessage');
          const assistantMessage: AiHelpMessage = { role: 'assistant', content };
          this.messages.update(msgs => {
            const updated = [...msgs, assistantMessage].slice(-MAX_STORED_MESSAGES);
            this.saveToStorage(updated);
            return updated;
          });
          this.streamingContent.set('');
          this.loading.set(false);
          this.scrollToBottom();
        },
        complete: () => {
          const accumulated = this.streamingContent();
          if (accumulated) {
            const assistantMessage: AiHelpMessage = { role: 'assistant', content: accumulated };
            this.messages.update(msgs => {
              const updated = [...msgs, assistantMessage].slice(-MAX_STORED_MESSAGES);
              this.saveToStorage(updated);
              return updated;
            });
          }
          this.streamingContent.set('');
          this.loading.set(false);
          this.scrollToBottom();
        },
      });
  }

  private loadFromStorage(): AiHelpMessage[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(messages: AiHelpMessage[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(messages));
    } catch {
      // storage full — skip silently
    }
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
