import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { MatTooltipModule } from '@angular/material/tooltip';

import { AiService, AiHelpMessage } from '../../shared/services/ai.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TermTextPipe } from '../../shared/pipes/term-text.pipe';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { parsePositiveId } from '../../shared/utils/parse-positive-id';

export interface AiAssistantListItem {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  starterQuestions: string[];
  isActive: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-ai',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, LoadingBlockDirective, EmptyStateComponent, TranslatePipe, TermTextPipe],
  templateUrl: './ai.component.html',
  styleUrl: './ai.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiComponent {
  private readonly aiService = inject(AiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly assistants = signal<AiAssistantListItem[]>([]);
  protected readonly loadingAssistants = signal(false);
  private readonly assistantsLoaded = signal(false);
  protected readonly sending = signal(false);
  protected readonly messageInput = new FormControl('');

  private readonly conversations = signal<ReadonlyMap<number, readonly ChatMessage[]>>(new Map());

  protected readonly assistantIdParam = toSignal(
    this.route.paramMap.pipe(map(p => p.get('assistantId') ?? 'general')),
    { initialValue: 'general' },
  );

  protected readonly activeAssistant = computed(() => {
    const param = this.assistantIdParam();
    const list = this.assistants();
    if (param === 'general') {
      return list.find(a => a.category === 'General') ?? list[0] ?? null;
    }
    const id = parsePositiveId(param);
    return list.find(a => a.id === id) ?? null;
  });

  protected readonly assistantNotFound = computed(() =>
    this.assistantsLoaded() && this.assistantIdParam() !== 'general' && !this.activeAssistant());

  protected readonly messages = computed(() => {
    const assistant = this.activeAssistant();
    if (!assistant) return [];
    return this.conversations().get(assistant.id) ?? [];
  });

  protected readonly hasMessages = computed(() => this.messages().length > 0);

  constructor() {
    this.loadAssistants();

    // Navigate to actual ID when 'general' resolves
    effect(() => {
      const param = this.assistantIdParam();
      const assistant = this.activeAssistant();
      if (param === 'general' && assistant && this.assistants().length > 0) {
        this.router.navigate(['..', assistant.id.toString()], { relativeTo: this.route, replaceUrl: true });
      }
    });
  }

  private loadAssistants(): void {
    this.loadingAssistants.set(true);
    this.aiService.getAssistants().subscribe({
      next: (data) => {
        this.assistants.set(data);
        this.assistantsLoaded.set(true);
        this.loadingAssistants.set(false);
      },
      error: () => this.loadingAssistants.set(false),
    });
  }

  protected openGeneral(): void {
    this.router.navigate(['..', 'general'], { relativeTo: this.route, replaceUrl: true });
  }

  protected selectAssistant(assistant: AiAssistantListItem): void {
    this.router.navigate(['..', assistant.id.toString()], { relativeTo: this.route });
  }

  protected sendMessage(): void {
    const text = this.messageInput.value?.trim();
    const assistant = this.activeAssistant();
    if (!text || !assistant || this.sending()) return;

    const history = answeredHistory(this.conversations().get(assistant.id) ?? []).slice(-10);

    this.messageInput.reset();
    this.addMessage(assistant.id, { role: 'user', content: text, timestamp: new Date() });
    this.sending.set(true);

    this.aiService.assistantChat(assistant.id, text, history).subscribe({
      next: (response) => {
        this.addMessage(assistant.id, { role: 'assistant', content: response.answer, timestamp: new Date() });
        this.sending.set(false);
      },
      error: (err: unknown) => {
        const key = err instanceof HttpErrorResponse && err.status === 503 ? 'ai.unavailableMessage' : 'ai.errorMessage';
        this.addMessage(assistant.id, { role: 'error', content: this.translate.instant(key), timestamp: new Date() });
        this.sending.set(false);
      },
    });
  }

  protected askStarter(question: string): void {
    this.messageInput.setValue(question);
    this.sendMessage();
  }

  protected clearChat(): void {
    const assistant = this.activeAssistant();
    if (!assistant) return;
    this.conversations.update(m => new Map(m).set(assistant.id, []));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private addMessage(assistantId: number, message: ChatMessage): void {
    this.conversations.update(m => new Map(m).set(assistantId, [...(m.get(assistantId) ?? []), message]));
  }
}

function answeredHistory(messages: readonly ChatMessage[]): AiHelpMessage[] {
  const history: AiHelpMessage[] = [];
  messages.forEach((m, i) => {
    if (m.role === 'error') return;
    if (m.role === 'user' && messages[i + 1]?.role === 'error') return;
    history.push({ role: m.role, content: m.content });
  });
  return history;
}
