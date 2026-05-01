import { SelectOption } from '../../../../../shared/components/select/select.component';
import { ReferenceDataItem } from '../../../../../shared/services/reference-data.service';

/**
 * Polish-pass follow-up — Builds the MaterialSpec dropdown options from a
 * flat list of `part.material_spec` reference-data rows.
 *
 * The group is hierarchical: parents (e.g. "Aluminum", "Steel") group leaf
 * children (e.g. "6061-T6", "1018 Cold-Rolled") via `parentId`. Parents
 * are not selectable on their own — they only group children. Each leaf
 * option's label is prefixed with its parent's label so users read
 * "Aluminum / 6061-T6" rather than bare "6061-T6".
 *
 * Top-level rows that have NO children are passed through as plain leaves
 * (not every group is two levels deep).
 *
 * @param items raw reference-data rows from `/api/v1/reference-data/part.material_spec`
 * @returns SelectOption[] starting with the null sentinel "-- None --"
 */
export function buildMaterialSpecOptions(items: ReferenceDataItem[]): SelectOption[] {
  const active = items.filter(i => i.isActive);
  const byId = new Map<number, ReferenceDataItem>();
  for (const item of active) byId.set(item.id, item);

  const childIdsByParent = new Map<number, Set<number>>();
  for (const item of active) {
    if (item.parentId == null) continue;
    let bucket = childIdsByParent.get(item.parentId);
    if (!bucket) {
      bucket = new Set<number>();
      childIdsByParent.set(item.parentId, bucket);
    }
    bucket.add(item.id);
  }

  const options: SelectOption[] = [{ value: null, label: '-- None --' }];

  // Two pass: parents (sorted by sortOrder) then their children (sorted by
  // sortOrder). Top-level entries that have no children are surfaced as
  // standalone leaves.
  const topLevel = active
    .filter(i => i.parentId == null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const parent of topLevel) {
    const childIds = childIdsByParent.get(parent.id);
    if (!childIds || childIds.size === 0) {
      // Standalone leaf at top level — selectable on its own.
      options.push({ value: parent.id, label: parent.label });
      continue;
    }
    const children = active
      .filter(i => childIds.has(i.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const child of children) {
      options.push({ value: child.id, label: `${parent.label} / ${child.label}` });
    }
  }

  // Orphaned children (parentId points to a missing or inactive parent) —
  // surface them with a "(orphan)" prefix so admins notice the broken FK
  // rather than silently dropping the option.
  const orphans = active
    .filter(i => i.parentId != null && !byId.has(i.parentId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const orphan of orphans) {
    options.push({ value: orphan.id, label: `(orphan) ${orphan.label}` });
  }

  return options;
}
