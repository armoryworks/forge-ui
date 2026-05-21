import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { isCapabilityDisabledError } from '../errors/capability-disabled.error';
import { RagSearchResponse } from '../models/rag-search-response.model';
import { CapabilityService } from './capability.service';

export interface AiGenerateRequest {
  prompt: string;
  systemPrompt?: string;
}

export interface AiGenerateResponse {
  text: string;
}

export interface AiSummarizeRequest {
  text: string;
}

export interface AiSummarizeResponse {
  summary: string;
}

export interface AiAvailabilityResponse {
  available: boolean;
}

export interface AiSearchSuggestion {
  label: string;
  description: string;
  url: string;
  icon: string;
}

export interface AiHelpMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiHelpRequest {
  question: string;
  history?: AiHelpMessage[];
}

export interface AiHelpResponse {
  answer: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly capability = inject(CapabilityService);
  private readonly base = `${environment.apiUrl}/ai`;

  readonly available = signal(false);
  readonly checking = signal(false);
  /** Phase 4 Phase-D — true when AI capability is disabled for this install. */
  readonly capabilityDisabled = signal(false);

  checkAvailability(): void {
    // Descriptor may not be loaded yet at header init time. Wait for it
    // before testing the capability. capability.load() is deduped (F-001):
    // the in-flight observable is returned if already loading, so no extra
    // HTTP request fires.
    if (this.capability.descriptor() === null) {
      this.capability.load().subscribe({ next: () => this._fireAvailabilityCheck() });
      return;
    }
    this._fireAvailabilityCheck();
  }

  private _fireAvailabilityCheck(): void {
    // Layer-3 pre-check: descriptor is loaded — if AI is known-disabled,
    // skip the network call. Devtools network tab stays clean.
    if (this.capability.isKnown('CAP-EXT-AI-ASSISTANT')
      && !this.capability.isEnabled('CAP-EXT-AI-ASSISTANT')) {
      this.available.set(false);
      this.capabilityDisabled.set(true);
      this.checking.set(false);
      return;
    }

    this.checking.set(true);
    this.http.get<AiAvailabilityResponse>(`${this.base}/status`).pipe(
      tap(res => {
        this.available.set(res.available);
        this.capabilityDisabled.set(false);
        this.checking.set(false);
      }),
      catchError(err => {
        if (isCapabilityDisabledError(err)) {
          // AI is intentionally off — hide the AI surface, no error UI.
          this.capabilityDisabled.set(true);
        }
        this.available.set(false);
        this.checking.set(false);
        return of(null);
      }),
    ).subscribe();
  }

  generate(prompt: string): Observable<AiGenerateResponse> {
    return this.http.post<AiGenerateResponse>(`${this.base}/generate`, { prompt });
  }

  summarize(text: string): Observable<AiSummarizeResponse> {
    return this.http.post<AiSummarizeResponse>(`${this.base}/summarize`, { text });
  }

  searchSuggest(query: string): Observable<AiSearchSuggestion[]> {
    return this.http.post<AiSearchSuggestion[]>(`${this.base}/search-suggest`, { query });
  }

  helpChat(question: string, history?: AiHelpMessage[]): Observable<AiHelpResponse> {
    return this.http.post<AiHelpResponse>(`${this.base}/help`, { question, history });
  }

  streamHelpChat(question: string, history?: AiHelpMessage[]): Observable<string> {
    const url = `${this.base}/help/stream`;
    const body = JSON.stringify({ question, history });
    const token = localStorage.getItem('forge-token');

    return new Observable<string>(subscriber => {
      const controller = new AbortController();

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body,
        signal: controller.signal,
      }).then(response => {
        if (!response.ok || !response.body) {
          subscriber.error(new Error(`Stream request failed: ${response.status}`));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const pump = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) {
              subscriber.complete();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6);
              if (payload === '[DONE]') {
                subscriber.complete();
                return;
              }
              // Unescape newlines that were escaped server-side
              const token = payload.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
              subscriber.next(token);
            }

            return pump();
          });

        pump().catch(err => {
          if (err?.name !== 'AbortError') subscriber.error(err);
        });
      }).catch(err => {
        if (err?.name !== 'AbortError') subscriber.error(err);
      });

      return () => controller.abort();
    });
  }

  ragSearch(query: string, entityTypeFilter?: string, includeAnswer = false): Observable<RagSearchResponse> {
    return this.http.post<RagSearchResponse>(`${this.base}/search`, {
      query,
      entityTypeFilter,
      includeAnswer,
    });
  }

  ragHelpChat(message: string, conversationHistory?: string[]): Observable<string> {
    return this.http.post(`${this.base}/help`, { message, conversationHistory }, { responseType: 'text' });
  }

  indexDocument(entityType: string, entityId: number): Observable<number> {
    return this.http.post<number>(`${this.base}/index`, { entityType, entityId });
  }

  getAssistants(): Observable<{ id: number; name: string; description: string; icon: string; color: string; category: string; starterQuestions: string[]; isActive: boolean }[]> {
    return this.http.get<{ id: number; name: string; description: string; icon: string; color: string; category: string; starterQuestions: string[]; isActive: boolean }[]>(
      `${environment.apiUrl}/ai-assistants`);
  }

  assistantChat(assistantId: number, question: string, history?: AiHelpMessage[]): Observable<AiHelpResponse> {
    return this.http.post<AiHelpResponse>(`${this.base}/assistants/${assistantId}/chat`, { question, history });
  }
}
