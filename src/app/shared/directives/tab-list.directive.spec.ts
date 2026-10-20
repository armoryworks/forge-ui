import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';

import { TabListDirective, TabDirective } from './tab-list.directive';

@Component({
  standalone: true,
  imports: [TabListDirective, TabDirective],
  template: `
    <div class="tab-bar" appTabList>
      <button class="tab" [appTab]="active() === 'a'" (click)="active.set('a')">A</button>
      <button class="tab" [appTab]="active() === 'b'" (click)="active.set('b')">B</button>
      <button class="tab" data-testid="action">Action</button>
      @if (showC()) {
        <button class="tab" [appTab]="active() === 'c'" (click)="active.set('c')">C</button>
      }
    </div>
  `,
})
class HostComponent {
  readonly active = signal('a');
  readonly showC = signal(true);
}

describe('TabListDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let list: HTMLElement;
  let tabs: HTMLButtonElement[];

  const press = (target: HTMLElement, key: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    list = fixture.nativeElement.querySelector('.tab-bar');
    tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  });

  it('gives the bar and its tabs tab semantics', () => {
    expect(list.getAttribute('role')).toBe('tablist');
    expect(tabs.length).toBe(3);
    expect(tabs.every(t => t.getAttribute('type') === 'button')).toBe(true);
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map(t => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(tabs[0].classList.contains('tab--active')).toBe(true);
  });

  it('follows the active tab when it changes', () => {
    tabs[1].click();
    fixture.detectChanges();

    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs.map(t => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(tabs[1].classList.contains('tab--active')).toBe(true);
  });

  it('keeps the first tab in the Tab order when the active tab is not shown', () => {
    fixture.componentInstance.active.set('c');
    fixture.detectChanges();
    expect(tabs.map(t => t.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);

    fixture.componentInstance.showC.set(false);
    fixture.detectChanges();
    const shown = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

    expect(shown.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'false']);
    expect(shown.map(t => t.getAttribute('tabindex'))).toEqual(['0', '-1']);
  });

  it('moves focus between tabs with the arrow, Home and End keys, skipping non-tab buttons', () => {
    tabs[0].focus();

    expect(press(tabs[0], 'ArrowRight').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(tabs[1]);
    press(tabs[1], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[2]);
    press(tabs[2], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[0]);
    press(tabs[0], 'ArrowLeft');
    expect(document.activeElement).toBe(tabs[2]);
    press(tabs[2], 'Home');
    expect(document.activeElement).toBe(tabs[0]);
    press(tabs[0], 'End');
    expect(document.activeElement).toBe(tabs[2]);
  });

  it('leaves other keys and keys on non-tab buttons alone', () => {
    tabs[0].focus();
    expect(press(tabs[0], 'a').defaultPrevented).toBe(false);

    const action = list.querySelector<HTMLElement>('[data-testid="action"]')!;
    expect(press(action, 'ArrowRight').defaultPrevented).toBe(false);
  });
});
