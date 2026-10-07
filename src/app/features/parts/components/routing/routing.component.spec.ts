import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';

import { RoutingComponent } from './routing.component';
import { PartsService } from '../../services/parts.service';
import { DraftResumeService } from '../../../../shared/services/draft-resume.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface RoutingInternals {
  expandedInstructions(): ReadonlySet<number>;
  toggleInstructions(operationId: number): void;
}

function setup(): RoutingInternals {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: PartsService, useValue: { getOperations: vi.fn(() => of([])) } },
      { provide: DraftResumeService, useValue: { consume: vi.fn(() => false) } },
    ],
  });
  return TestBed.runInInjectionContext(() => new RoutingComponent()) as unknown as RoutingInternals;
}

describe('RoutingComponent — instruction expansion', () => {
  it('starts with every card collapsed', () => {
    expect(setup().expandedInstructions().size).toBe(0);
  });

  it('expands and collapses each card independently', () => {
    const component = setup();

    component.toggleInstructions(1);
    component.toggleInstructions(2);
    expect([...component.expandedInstructions()]).toEqual([1, 2]);

    component.toggleInstructions(1);
    expect(component.expandedInstructions().has(1)).toBe(false);
    expect(component.expandedInstructions().has(2)).toBe(true);
  });

  it('replaces the set on each toggle so signal consumers see the change', () => {
    const component = setup();
    const before = component.expandedInstructions();

    component.toggleInstructions(5);

    expect(component.expandedInstructions()).not.toBe(before);
    expect(before.has(5)).toBe(false);
  });
});
