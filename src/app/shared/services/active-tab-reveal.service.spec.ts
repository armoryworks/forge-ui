import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ActiveTabRevealService } from './active-tab-reveal.service';

function rect(left: number, width: number): DOMRect {
  return { left, right: left + width, width, top: 0, bottom: 32, height: 32, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
}

describe('ActiveTabRevealService', () => {
  let service: ActiveTabRevealService;
  let bar: HTMLElement;
  let tab: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    service = TestBed.inject(ActiveTabRevealService);
    bar = document.createElement('div');
    bar.className = 'tab-bar';
    tab = document.createElement('button');
    tab.className = 'tab tab--active';
    bar.appendChild(tab);
    document.body.appendChild(bar);
    Object.defineProperty(bar, 'clientWidth', { value: 600 });
    Object.defineProperty(bar, 'scrollWidth', { value: 1400, configurable: true });
    bar.getBoundingClientRect = () => rect(100, 600);
  });

  afterEach(() => bar.remove());

  it('scrolls an off-screen active tab on the right just into view', () => {
    tab.getBoundingClientRect = () => rect(1000, 120);

    service.reveal();

    expect(bar.scrollLeft).toBe(420);
  });

  it('scrolls back when the active tab is cut off on the left', () => {
    bar.scrollLeft = 300;
    tab.getBoundingClientRect = () => rect(40, 120);

    service.reveal();

    expect(bar.scrollLeft).toBe(240);
  });

  it('leaves a visible active tab and a bar that does not overflow alone', () => {
    tab.getBoundingClientRect = () => rect(200, 120);
    service.reveal();
    expect(bar.scrollLeft).toBe(0);

    Object.defineProperty(bar, 'scrollWidth', { value: 600 });
    tab.getBoundingClientRect = () => rect(1000, 120);
    service.reveal();
    expect(bar.scrollLeft).toBe(0);
  });
});
