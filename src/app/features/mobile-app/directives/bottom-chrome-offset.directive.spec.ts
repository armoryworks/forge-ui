import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BOTTOM_CHROME_OFFSET_PROPERTY, BottomChromeOffsetDirective } from './bottom-chrome-offset.directive';

@Component({
  standalone: true,
  imports: [BottomChromeOffsetDirective],
  template: `@if (shown()) { <div class="chrome" appBottomChromeOffset></div> }`,
})
class HostComponent {
  readonly shown = signal(true);
}

describe('BottomChromeOffsetDirective', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty(BOTTOM_CHROME_OFFSET_PROPERTY);
    vi.restoreAllMocks();
  });

  it('publishes the chrome height and clears it when the chrome goes away', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 131.6 } as DOMRect);
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    TestBed.tick();

    expect(document.documentElement.style.getPropertyValue(BOTTOM_CHROME_OFFSET_PROPERTY)).toBe('132px');

    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();

    expect(document.documentElement.style.getPropertyValue(BOTTOM_CHROME_OFFSET_PROPERTY)).toBe('');
  });
});
