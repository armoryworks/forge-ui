import { describe, expect, it } from 'vitest';

import { ActivityItem } from '../models/activity.model';
import { collapseFieldChanges } from './activity-batching';

const at = (seconds: number) => new Date(Date.UTC(2026, 9, 16, 9, 2, seconds));
const label = (count: number) => `Updated ${count} fields`;

function field(id: number, description: string, seconds = 21, userInitials = 'CT'): ActivityItem {
  return { id, action: 'FieldChanged', description, createdAt: at(seconds), userInitials };
}

describe('collapseFieldChanges', () => {
  it('folds the field rows of one save under its summary entry', () => {
    const items: ActivityItem[] = [
      { id: 10, action: 'credit-hold-released', description: 'Credit hold released', createdAt: at(22), userInitials: 'CT' },
      field(11, 'Is On Credit Hold: true → false'),
      field(12, 'Credit Hold Reason: Pending → (none)'),
      field(13, 'Credit Hold At: 2026-10-16 → (none)'),
      field(14, 'Credit Hold By: Casey Thompson → (none)'),
    ];

    const result = collapseFieldChanges(items, label);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Credit hold released');
    expect(result[0].batchedItems?.map(i => i.id)).toEqual([11, 12, 13, 14]);
  });

  it('folds field rows logged just before their summary entry', () => {
    const items: ActivityItem[] = [
      field(11, 'Status: New → Converted', 30),
      field(12, 'Converted Customer: (none) → Granite Peak', 30),
      { id: 10, action: 'converted', description: 'Converted to customer', createdAt: at(29), userInitials: 'PM' },
    ].map(i => ({ ...i, userInitials: 'PM' }));

    const result = collapseFieldChanges(items, label);

    expect(result).toHaveLength(1);
    expect(result[0].batchedItems).toHaveLength(2);
  });

  it('batches field rows with no summary into one updated-fields entry', () => {
    const result = collapseFieldChanges([field(1, 'Name: A → B'), field(2, 'Phone: 1 → 2')], label);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Updated 2 fields');
    expect(result[0].batchedItems).toHaveLength(2);
  });

  it('keeps a lone field row as is', () => {
    const result = collapseFieldChanges([field(1, 'Name: A → B')], label);

    expect(result).toEqual([field(1, 'Name: A → B')]);
  });

  it('never folds field rows under a comment, a note or another user\'s entry', () => {
    const items: ActivityItem[] = [
      { id: 5, action: 'Comment', description: 'Looks good', createdAt: at(21), userInitials: 'CT' },
      { id: 6, action: 'updated', description: 'Updated 1 field', createdAt: at(21), userInitials: 'AK' },
      field(7, 'Name: A → B'),
    ];

    const result = collapseFieldChanges(items, label);

    expect(result.map(r => r.id)).toEqual([5, 6, 7]);
    expect(result.every(r => !r.batchedItems)).toBe(true);
  });

  it('does not merge saves that are seconds apart', () => {
    const result = collapseFieldChanges([field(1, 'Name: A → B', 40), field(2, 'Phone: 1 → 2', 21)], label);

    expect(result.map(r => r.id)).toEqual([1, 2]);
  });
});
