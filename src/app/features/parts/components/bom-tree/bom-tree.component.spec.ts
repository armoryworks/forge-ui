import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { BOMLine } from '../../models/bom-line.model';
import { BomTreeNode } from '../../models/bom-tree-node.model';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';
import { BomTreeComponent } from './bom-tree.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function line(id: number, childPartId: number, childPartNumber: string, childHasBom = false, sortOrder = id): BOMLine {
  return {
    id, childPartId, childPartNumber, childName: childPartNumber, quantity: 1, referenceDesignator: null,
    sortOrder, sourceType: 'Make', leadTimeDays: null, notes: null, uomId: null, uomCode: null, uomLabel: null,
    childHasBom,
  };
}

interface TreeInternals {
  flattenedNodes(): BomTreeNode[];
  toggleExpand(node: BomTreeNode): void;
}

describe('BomTreeComponent', () => {
  let getPartById: ReturnType<typeof vi.fn>;
  let responses: Map<number, Subject<PartDetail>>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    responses = new Map();
    getPartById = vi.fn((id: number) => {
      const subject = new Subject<PartDetail>();
      responses.set(id, subject);
      return subject;
    });
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: PartsService, useValue: { getPartById } },
      ],
    });
  });

  function create(entries: BOMLine[]): TreeInternals {
    const component = TestBed.runInInjectionContext(() => new BomTreeComponent());
    mockSignalInputs(component, { entries });
    return component as unknown as TreeInternals;
  }

  function respond(partId: number, bomLines: BOMLine[]): void {
    responses.get(partId)!.next({ bomLines } as PartDetail);
  }

  function rows(tree: TreeInternals): string[] {
    return tree.flattenedNodes().map(n => `${'  '.repeat(n.level)}${n.entry.childPartNumber}`);
  }

  it('lists the part\'s own lines and marks only children with a BOM as expandable', () => {
    const tree = create([line(1, 210, 'SA-210', true), line(2, 61, 'RM-6061-B12')]);

    expect(rows(tree)).toEqual(['SA-210', 'RM-6061-B12']);
    expect(tree.flattenedNodes().map(n => n.hasChildren)).toEqual([true, false]);
  });

  it('loads a sub-assembly\'s lines on first expand and shows them indented, at any depth', () => {
    const tree = create([line(1, 210, 'SA-210', true)]);

    tree.toggleExpand(tree.flattenedNodes()[0]);
    expect(getPartById).toHaveBeenCalledWith(210);
    expect(tree.flattenedNodes()[0].isLoading).toBe(true);
    respond(210, [line(12, 300, 'SA-300', true, 2), line(11, 61, 'RM-6061-B12', false, 1)]);

    expect(rows(tree)).toEqual(['SA-210', '  RM-6061-B12', '  SA-300']);

    tree.toggleExpand(tree.flattenedNodes()[2]);
    respond(300, [line(21, 62, 'RM-HW-1')]);

    expect(rows(tree)).toEqual(['SA-210', '  RM-6061-B12', '  SA-300', '    RM-HW-1']);
  });

  it('collapses without refetching and reuses the loaded lines on re-expand', () => {
    const tree = create([line(1, 210, 'SA-210', true)]);
    tree.toggleExpand(tree.flattenedNodes()[0]);
    respond(210, [line(11, 61, 'RM-6061-B12')]);

    tree.toggleExpand(tree.flattenedNodes()[0]);
    expect(rows(tree)).toEqual(['SA-210']);
    tree.toggleExpand(tree.flattenedNodes()[0]);

    expect(rows(tree)).toEqual(['SA-210', '  RM-6061-B12']);
    expect(getPartById).toHaveBeenCalledTimes(1);
  });

  it('does not let a BOM cycle expand the same part again on its own branch', () => {
    const tree = create([line(1, 210, 'SA-210', true)]);
    tree.toggleExpand(tree.flattenedNodes()[0]);
    respond(210, [line(11, 210, 'SA-210', true)]);

    const nested = tree.flattenedNodes()[1];
    expect(nested.level).toBe(1);
    expect(nested.hasChildren).toBe(false);
  });
});
