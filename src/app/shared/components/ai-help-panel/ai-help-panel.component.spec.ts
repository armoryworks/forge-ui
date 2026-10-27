import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { AiService, AiStreamError } from '../../services/ai.service';
import { AuthService } from '../../services/auth.service';
import { AiHelpPanelComponent } from './ai-help-panel.component';

interface Internals {
  inputControl: { setValue(v: string): void };
  messages(): { role: string; content: string }[];
  streamNoticeKey(): string | null;
  loading(): boolean;
  send(): void;
}

function setup() {
  const stream = new Subject<string>();
  TestBed.configureTestingModule({
    providers: [
      { provide: AiService, useValue: { streamHelpChat: vi.fn(() => stream) } },
      { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      { provide: HttpClient, useValue: { get: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new AiHelpPanelComponent()) as unknown as Internals;
  return { component, stream };
}

describe('AiHelpPanelComponent stream errors', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('keeps the partial answer and shows the stall message', () => {
    const { component, stream } = setup();

    component.inputControl.setValue('How do I receive a PO?');
    component.send();
    stream.next('Open the PO and ');
    stream.error(new AiStreamError('ai-stream-stalled'));

    expect(component.messages().at(-1)).toEqual({ role: 'assistant', content: 'Open the PO and ' });
    expect(component.streamNoticeKey()).toBe('aiHelp.streamStalled');
    expect(component.loading()).toBe(false);
  });

  it('shows the failure message alone when nothing arrived', () => {
    const { component, stream } = setup();

    component.inputControl.setValue('Hi');
    component.send();
    stream.error(new AiStreamError('ai-stream-failed'));

    expect(component.messages().at(-1)).toEqual({ role: 'assistant', content: 'aiHelp.streamFailed' });
    expect(component.streamNoticeKey()).toBeNull();
  });

  it('maps only stream errors to a notice', () => {
    expect(AiHelpPanelComponent.streamNoticeKeyFor(new Error('network'))).toBeNull();
    expect(AiHelpPanelComponent.streamNoticeKeyFor(new AiStreamError('ai-stream-stalled'))).toBe('aiHelp.streamStalled');
  });
});
