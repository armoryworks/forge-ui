import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ScrollCueDirective } from './scroll-cue.directive';

@Component({
  standalone: true,
  imports: [ScrollCueDirective],
  template: `<div class="strip" appScrollCue><span>one</span><span>two</span></div>`,
})
class HostComponent {}

function setMetrics(el: HTMLElement, metrics: { scrollLeft: number; clientWidth: number; scrollWidth: number }): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: metrics.clientWidth });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: metrics.scrollWidth });
  Object.defineProperty(el, 'scrollLeft', { configurable: true, writable: true, value: metrics.scrollLeft });
}

describe('ScrollCueDirective', () => {
  function create(): { strip: HTMLElement; directive: ScrollCueDirective } {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const debug = fixture.debugElement.children[0];
    return { strip: debug.nativeElement as HTMLElement, directive: debug.injector.get(ScrollCueDirective) };
  }

  it('adds no cue when the content fits', () => {
    const { strip, directive } = create();
    setMetrics(strip, { scrollLeft: 0, clientWidth: 400, scrollWidth: 400 });
    directive.update();

    expect(strip.classList.contains('scroll-cue--start')).toBe(false);
    expect(strip.classList.contains('scroll-cue--end')).toBe(false);
  });

  it('cues the end edge when more content sits to the right', () => {
    const { strip, directive } = create();
    setMetrics(strip, { scrollLeft: 0, clientWidth: 400, scrollWidth: 900 });
    directive.update();

    expect(strip.classList.contains('scroll-cue--start')).toBe(false);
    expect(strip.classList.contains('scroll-cue--end')).toBe(true);
  });

  it('cues both edges mid-scroll and only the start edge at the far end', () => {
    const { strip, directive } = create();
    setMetrics(strip, { scrollLeft: 200, clientWidth: 400, scrollWidth: 900 });
    directive.update();
    expect(strip.classList.contains('scroll-cue--start')).toBe(true);
    expect(strip.classList.contains('scroll-cue--end')).toBe(true);

    setMetrics(strip, { scrollLeft: 500, clientWidth: 400, scrollWidth: 900 });
    strip.dispatchEvent(new Event('scroll'));
    expect(strip.classList.contains('scroll-cue--start')).toBe(true);
    expect(strip.classList.contains('scroll-cue--end')).toBe(false);
  });
});
