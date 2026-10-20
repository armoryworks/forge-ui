import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';

import { DetailLoadErrorComponent } from './detail-load-error.component';

describe('DetailLoadErrorComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [DetailLoadErrorComponent, TranslateModule.forRoot()] });
  });

  function render(error: unknown) {
    const fixture = TestBed.createComponent(DetailLoadErrorComponent);
    fixture.componentRef.setInput('error', error);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      icon: el.querySelector('.empty-state__icon')?.textContent?.trim(),
      message: el.querySelector('.empty-state__message')?.textContent?.trim(),
      button: el.querySelector('button') as HTMLButtonElement,
    };
  }

  it('says the record was not found on a 404', () => {
    const { icon, message } = render(new HttpErrorResponse({ status: 404 }));
    expect(icon).toBe('search_off');
    expect(message).toBe('detailLoadError.notFound');
  });

  it('says access was denied on a 403', () => {
    const { icon, message } = render(new HttpErrorResponse({ status: 403 }));
    expect(icon).toBe('lock');
    expect(message).toBe('detailLoadError.forbidden');
  });

  it('falls back to a generic load failure for anything else', () => {
    expect(render(new HttpErrorResponse({ status: 500 })).message).toBe('detailLoadError.failed');
    expect(render(new Error('boom')).message).toBe('detailLoadError.failed');
  });

  it('emits closed from its Close button', () => {
    const { fixture, button } = render(new HttpErrorResponse({ status: 404 }));
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    button.click();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});

describe('DetailLoadErrorComponent actions', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [DetailLoadErrorComponent, TranslateModule.forRoot()] });
  });

  function render(error: unknown, inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(DetailLoadErrorComponent);
    fixture.componentRef.setInput('error', error);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    const closed = vi.fn();
    const retry = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.retry.subscribe(retry);
    const button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    return { button, closed, retry };
  }

  it('uses the given close label', () => {
    const { button } = render(new HttpErrorResponse({ status: 404 }), { closeLabel: 'detailLoadError.backToList' });
    expect(button.textContent?.trim()).toBe('detailLoadError.backToList');
  });

  it('offers a retry instead of close for a failed load when retryable', () => {
    const { button, closed, retry } = render(new HttpErrorResponse({ status: 500 }), { retryable: true });
    expect(button.textContent?.trim()).toBe('detailLoadError.retry');
    button.click();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
  });

  it('still closes on a 404 when retryable', () => {
    const { button, closed, retry } = render(new HttpErrorResponse({ status: 404 }), { retryable: true });
    button.click();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
