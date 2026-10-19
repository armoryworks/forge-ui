import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DashboardWidgetComponent } from './dashboard-widget.component';

describe('DashboardWidgetComponent', () => {
  it('lets keyboard users reach and scroll the widget body', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DashboardWidgetComponent);
    fixture.componentRef.setInput('title', 'Activity');
    fixture.detectChanges();

    const body = fixture.nativeElement.querySelector('.widget__body') as HTMLElement;
    expect(body.getAttribute('tabindex')).toBe('0');
    expect(body.getAttribute('role')).toBe('region');
    expect(body.getAttribute('aria-label')).toBe('Activity');
  });
});
