import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { Observable, of } from 'rxjs';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { BoardColumnComponent } from './board-column.component';
import { Stage } from '../../../shared/models/stage.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface ColumnInternals {
  canEnter: (drag: CdkDrag, drop: CdkDropList) => boolean;
}

function stage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 8,
    name: 'Shipped',
    code: 'shipped',
    sortOrder: 8,
    color: '#c2410c',
    wipLimit: null,
    accountingDocumentType: null,
    isIrreversible: false,
    isMandatory: false,
    ...overrides,
  };
}

describe('BoardColumnComponent', () => {
  let fixture: ComponentFixture<BoardColumnComponent>;
  const ownList = {} as CdkDropList;
  const otherList = {} as CdkDropList;
  const dragFromElsewhere = { dropContainer: otherList } as unknown as CdkDrag;

  function render(columnStage: Stage, billingLocked: boolean): ColumnInternals {
    fixture.componentRef.setInput('column', { stage: columnStage, jobs: [] });
    fixture.componentRef.setInput('billingLocked', billingLocked);
    return fixture.componentInstance as unknown as ColumnInternals;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoardColumnComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } })],
    });
    fixture = TestBed.createComponent(BoardColumnComponent);
    fixture.componentRef.setInput('allDropListIds', []);
    fixture.componentRef.setInput('dropListId', 'column-0');
  });

  it('accepts a card from another column into an ordinary column', () => {
    expect(render(stage(), true).canEnter(dragFromElsewhere, ownList)).toBe(true);
  });

  it('refuses a card from another column into a billing column when billing is locked', () => {
    expect(render(stage({ accountingDocumentType: 'Invoice' }), true).canEnter(dragFromElsewhere, ownList)).toBe(false);
  });

  it('accepts a card into a billing column when billing is not locked', () => {
    expect(render(stage({ accountingDocumentType: 'Payment' }), false).canEnter(dragFromElsewhere, ownList)).toBe(true);
  });

  it('refuses a card from another column into an irreversible column', () => {
    expect(render(stage({ isIrreversible: true }), false).canEnter(dragFromElsewhere, ownList)).toBe(false);
  });
});
