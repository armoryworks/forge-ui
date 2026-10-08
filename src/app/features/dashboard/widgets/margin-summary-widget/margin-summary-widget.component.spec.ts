import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../../../environments/environment';
import { MarginSummaryWidgetComponent } from './margin-summary-widget.component';

interface WidgetInternals {
  ngOnInit(): void;
  costMissing: { (): boolean };
  uncostedJobCount: { (): number };
}

const url = `${environment.apiUrl}/dashboard/margin-summary`;

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const component = TestBed.runInInjectionContext(() => new MarginSummaryWidgetComponent()) as unknown as WidgetInternals;
  const httpMock = TestBed.inject(HttpTestingController);
  component.ngOnInit();
  return { component, httpMock };
}

describe('MarginSummaryWidgetComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('reports cost as not recorded when no job in the window has a cost', () => {
    const { component, httpMock } = setup();

    httpMock.expectOne(url).flush({
      totalRevenue: 1000, totalCost: 0, totalMargin: 1000, averageMarginPercentage: 0, jobCount: 2, costedJobCount: 0,
    });

    expect(component.costMissing()).toBe(true);
    expect(component.uncostedJobCount()).toBe(2);
  });

  it('shows the margin and counts the jobs still missing a cost', () => {
    const { component, httpMock } = setup();

    httpMock.expectOne(url).flush({
      totalRevenue: 1500, totalCost: 750, totalMargin: 750, averageMarginPercentage: 25, jobCount: 3, costedJobCount: 2,
    });

    expect(component.costMissing()).toBe(false);
    expect(component.uncostedJobCount()).toBe(1);
  });

  it('does not flag missing cost when there are no jobs at all', () => {
    const { component, httpMock } = setup();

    httpMock.expectOne(url).flush({
      totalRevenue: 0, totalCost: 0, totalMargin: 0, averageMarginPercentage: 0, jobCount: 0, costedJobCount: 0,
    });

    expect(component.costMissing()).toBe(false);
    expect(component.uncostedJobCount()).toBe(0);
  });
});
