import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { ChatMessageAreaComponent } from './chat-message-area.component';

describe('ChatMessageAreaComponent composer', () => {
  let fixture: ComponentFixture<ChatMessageAreaComponent>;
  let input: HTMLInputElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ChatMessageAreaComponent, TranslateModule.forRoot()],
      providers: [provideNoopAnimations(), { provide: AuthService, useValue: { user: signal({ id: 1 }) } }],
    });
    fixture = TestBed.createComponent(ChatMessageAreaComponent);
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="chat-message-input"]') as HTMLInputElement;
  });

  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('keeps the draft after sending until the host confirms it was delivered', () => {
    const sent: string[] = [];
    fixture.componentInstance.messageSent.subscribe(v => sent.push(v));
    type('  hello  ');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(sent).toEqual(['hello']);
    expect(input.value).toBe('  hello  ');

    fixture.componentInstance.clearComposer();
    fixture.detectChanges();

    expect(input.value).toBe('');
  });

  it('hides the paperclip when the host does not support attachments', () => {
    fixture.componentRef.setInput('showFileAttach', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.message-area__file-input')).toBeNull();
  });
});
