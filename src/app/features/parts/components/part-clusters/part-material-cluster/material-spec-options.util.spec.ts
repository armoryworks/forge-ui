import { describe, expect, it } from 'vitest';

import { ReferenceDataItem } from '../../../../../shared/services/reference-data.service';
import { buildMaterialSpecOptions } from './material-spec-options.util';

function ref(overrides: Partial<ReferenceDataItem> & Pick<ReferenceDataItem, 'id' | 'label'>): ReferenceDataItem {
  return {
    groupCode: 'part.material_spec',
    code: overrides.code ?? `code-${overrides.id}`,
    sortOrder: overrides.sortOrder ?? 0,
    isActive: overrides.isActive ?? true,
    parentId: overrides.parentId ?? null,
    ...overrides,
  };
}

describe('buildMaterialSpecOptions', () => {
  it('starts with the null "-- None --" sentinel', () => {
    const opts = buildMaterialSpecOptions([]);
    expect(opts.length).toBeGreaterThanOrEqual(1);
    expect(opts[0]).toEqual({ value: null, label: '-- None --' });
  });

  it('groups leaves under their parent with prefixed labels', () => {
    const items: ReferenceDataItem[] = [
      ref({ id: 1, label: 'Aluminum', sortOrder: 1 }),
      ref({ id: 2, label: '6061-T6', parentId: 1, sortOrder: 1 }),
      ref({ id: 3, label: '7075-T6', parentId: 1, sortOrder: 2 }),
      ref({ id: 4, label: 'Steel', sortOrder: 2 }),
      ref({ id: 5, label: '1018 Cold-Rolled', parentId: 4, sortOrder: 1 }),
    ];
    const opts = buildMaterialSpecOptions(items);

    // Should NOT contain bare "Aluminum" or "Steel" — parents are not selectable.
    const labels = opts.map(o => o.label);
    expect(labels).not.toContain('Aluminum');
    expect(labels).not.toContain('Steel');

    // Should contain all leaves prefixed with parent label.
    expect(labels).toContain('Aluminum / 6061-T6');
    expect(labels).toContain('Aluminum / 7075-T6');
    expect(labels).toContain('Steel / 1018 Cold-Rolled');

    // Leaf values are the leaf's own id.
    const aluminum6061 = opts.find(o => o.label === 'Aluminum / 6061-T6');
    expect(aluminum6061?.value).toBe(2);
  });

  it('treats top-level rows with no children as standalone leaves', () => {
    const items: ReferenceDataItem[] = [
      ref({ id: 10, label: 'Plastic ABS', sortOrder: 1 }),
    ];
    const opts = buildMaterialSpecOptions(items);
    expect(opts.find(o => o.label === 'Plastic ABS')?.value).toBe(10);
  });

  it('skips inactive entries entirely', () => {
    const items: ReferenceDataItem[] = [
      ref({ id: 1, label: 'Aluminum', sortOrder: 1 }),
      ref({ id: 2, label: '6061-T6', parentId: 1, sortOrder: 1, isActive: false }),
      ref({ id: 3, label: '7075-T6', parentId: 1, sortOrder: 2 }),
    ];
    const opts = buildMaterialSpecOptions(items);
    expect(opts.find(o => o.label === 'Aluminum / 6061-T6')).toBeUndefined();
    expect(opts.find(o => o.label === 'Aluminum / 7075-T6')?.value).toBe(3);
  });

  it('flags orphaned children whose parent is missing', () => {
    const items: ReferenceDataItem[] = [
      ref({ id: 99, label: 'Lonely Leaf', parentId: 12345, sortOrder: 1 }),
    ];
    const opts = buildMaterialSpecOptions(items);
    expect(opts.find(o => o.label === '(orphan) Lonely Leaf')?.value).toBe(99);
  });
});
