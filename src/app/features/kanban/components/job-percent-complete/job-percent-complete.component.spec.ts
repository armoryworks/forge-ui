import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';

import { provideTranslateService } from '@ngx-translate/core';

import { JobPercentCompleteComponent } from './job-percent-complete.component';

interface Internals {
  value: () => number | null;
  complete: () => boolean;
}

describe('JobPercentCompleteComponent', () => {
  let ref: ComponentRef<JobPercentCompleteComponent>;
  let component: Internals;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [JobPercentCompleteComponent], providers: [provideTranslateService()] });
    TestBed.overrideComponent(JobPercentCompleteComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(JobPercentCompleteComponent);
    ref = fixture.componentRef;
    component = fixture.componentInstance as unknown as Internals;
  });

  it('shows the whole percent the API sends', () => {
    ref.setInput('percent', 41);
    expect(component.value()).toBe(41);
    expect(component.complete()).toBe(false);
  });

  it('marks a finished job complete', () => {
    ref.setInput('percent', 100);
    expect(component.complete()).toBe(true);
  });

  it.each([[null], [undefined], [Number.NaN]])('is empty for a job with nothing to measure (%s)', percent => {
    ref.setInput('percent', percent);
    expect(component.value()).toBeNull();
    expect(component.complete()).toBe(false);
  });

  it.each([[-5, 0], [140, 100], [66.9, 66]])('keeps the bar inside 0 to 100 (%s → %s)', (percent, shown) => {
    ref.setInput('percent', percent);
    expect(component.value()).toBe(shown);
  });
});

describe('JobPercentCompleteComponent · rendering', () => {
  function render(percent: number | null): HTMLElement {
    TestBed.configureTestingModule({ imports: [JobPercentCompleteComponent], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(JobPercentCompleteComponent);
    fixture.componentRef.setInput('percent', percent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws a bar filled to the percent beside the number', () => {
    const el = render(41);

    expect(el.querySelector('.job-percent__value')!.textContent!.trim()).toBe('41%');
    expect((el.querySelector('.job-percent__fill') as HTMLElement).style.width).toBe('41%');
    expect(el.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('41');
  });

  it('renders nothing for a job with nothing to measure', () => {
    expect(render(null).querySelector('[data-testid="job-percent-complete"]')).toBeNull();
  });
});
