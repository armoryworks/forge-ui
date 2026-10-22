import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';

import { AiComponent } from './ai.component';
import { AiService, AiHelpMessage } from '../../shared/services/ai.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('AiComponent chat', () => {
  let fixture: ComponentFixture<AiComponent>;
  let assistantChat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assistantChat = vi.fn((_id: number, _q: string, _h?: AiHelpMessage[]) => of({ answer: 'Use fixture QF-FX-12.' }));

    TestBed.configureTestingModule({
      imports: [AiComponent],
      providers: [
        {
          provide: AiService,
          useValue: {
            getAssistants: () => of([{
              id: 7, name: 'General Assistant', description: 'Ask anything', icon: 'smart_toy',
              color: '#0d9488', category: 'General', starterQuestions: [], isActive: true,
            }]),
            assistantChat,
          },
        },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ assistantId: '7' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });

    fixture = TestBed.createComponent(AiComponent);
    fixture.detectChanges();
  });

  function send(text: string): void {
    const c = fixture.componentInstance as unknown as { messageInput: { setValue: (v: string) => void }; sendMessage: () => void };
    c.messageInput.setValue(text);
    c.sendMessage();
    fixture.detectChanges();
  }

  it('renders the question and the answer after sending', () => {
    send('Which fixture holds the bracket?');

    const el: HTMLElement = fixture.nativeElement;
    const messages = el.querySelectorAll('.chat-message');
    expect(messages.length).toBe(2);
    expect(messages[0].textContent).toContain('Which fixture holds the bracket?');
    expect(messages[1].textContent).toContain('Use fixture QF-FX-12.');
    expect(el.querySelector('.ai-chat__welcome')).toBeNull();
  });

  it('does not repeat the current question in the history it sends', () => {
    send('First question');
    send('Second question');

    const firstHistory = assistantChat.mock.calls[0][2] as AiHelpMessage[];
    const secondHistory = assistantChat.mock.calls[1][2] as AiHelpMessage[];
    expect(firstHistory).toEqual([]);
    expect(secondHistory.map(m => m.content)).toEqual(['First question', 'Use fixture QF-FX-12.']);
  });

  it('shows a failed reply as an error and leaves it and its question out of the next history', () => {
    assistantChat.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    send('Broken question');
    send('Next question');

    const el: HTMLElement = fixture.nativeElement;
    const error = el.querySelector('.chat-message--error');
    expect(error?.textContent).toContain('ai.errorMessage');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(el.querySelectorAll('.chat-message--assistant').length).toBe(1);
    const secondHistory = assistantChat.mock.calls[1][2] as AiHelpMessage[];
    expect(secondHistory).toEqual([]);
  });

  it('says the AI service is unavailable when the server answers 503', () => {
    assistantChat.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    send('Anyone there?');

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.chat-message--error')?.textContent).toContain('ai.unavailableMessage');
  });

  it('clear chat brings the welcome panel back', () => {
    send('Hello');
    (fixture.componentInstance as unknown as { clearChat: () => void }).clearChat();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.chat-message').length).toBe(0);
    expect(el.querySelector('.ai-chat__welcome')).not.toBeNull();
  });
});

describe('AiComponent unknown assistant', () => {
  function render(assistantId: string): { el: HTMLElement; navigate: ReturnType<typeof vi.fn>; fixture: ComponentFixture<AiComponent> } {
    const navigate = vi.fn();
    TestBed.configureTestingModule({
      imports: [AiComponent],
      providers: [
        {
          provide: AiService,
          useValue: {
            getAssistants: () => of([{
              id: 7, name: 'General Assistant', description: 'Ask anything', icon: 'smart_toy',
              color: '#0d9488', category: 'General', starterQuestions: [], isActive: true,
            }]),
            assistantChat: vi.fn(),
          },
        },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ assistantId })) } },
        { provide: Router, useValue: { navigate } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
    const fixture = TestBed.createComponent(AiComponent);
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, navigate, fixture };
  }

  it.each(['999', '7abc'])('says the assistant %s was not found', (id) => {
    const { el } = render(id);
    expect(el.querySelector('[data-testid="ai-assistant-not-found"]')).not.toBeNull();
  });

  it('offers the general assistant instead', () => {
    const { el, navigate } = render('999');
    (el.querySelector('[data-testid="ai-assistant-not-found"] button') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['..', 'general'], expect.objectContaining({ replaceUrl: true }));
  });

  it('shows a known assistant without the not-found state', () => {
    const { el } = render('7');
    expect(el.querySelector('[data-testid="ai-assistant-not-found"]')).toBeNull();
  });
});
