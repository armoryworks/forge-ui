import { ActivityItem } from '../models/activity.model';
import { DisplayActivity } from '../models/display-activity.model';

const FIELD_CHANGED = 'FieldChanged';
const BATCH_WINDOW_MS = 5000;
const NON_SUMMARY_ACTIONS = new Set([FIELD_CHANGED, 'Comment', 'note']);

function sameSave(a: ActivityItem, b: ActivityItem): boolean {
  return a.userInitials === b.userInitials
    && Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) < BATCH_WINDOW_MS;
}

function canAbsorb(summary: DisplayActivity | undefined, run: ActivityItem[]): summary is DisplayActivity {
  return !!summary
    && !summary.batchedItems
    && !NON_SUMMARY_ACTIONS.has(summary.action ?? '')
    && sameSave(summary, run[0]);
}

export function collapseFieldChanges(
  items: ActivityItem[],
  updatedFieldsLabel: (count: number) => string,
): DisplayActivity[] {
  const grouped: (DisplayActivity | ActivityItem[])[] = [];
  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    if (current.action !== FIELD_CHANGED) {
      grouped.push({ ...current });
      continue;
    }
    const run: ActivityItem[] = [current];
    while (i + 1 < items.length && items[i + 1].action === FIELD_CHANGED && sameSave(items[i + 1], current)) {
      run.push(items[++i]);
    }
    grouped.push(run);
  }

  const result: DisplayActivity[] = [];
  for (let i = 0; i < grouped.length; i++) {
    const entry = grouped[i];
    if (!Array.isArray(entry)) {
      result.push(entry);
      continue;
    }
    const newer = result[result.length - 1];
    const older = grouped[i + 1];
    if (canAbsorb(newer, entry)) {
      newer.batchedItems = entry;
    } else if (!Array.isArray(older) && canAbsorb(older, entry)) {
      older.batchedItems = entry;
    } else if (entry.length === 1) {
      result.push(entry[0]);
    } else {
      const [first] = entry;
      result.push({
        id: first.id,
        description: updatedFieldsLabel(entry.length),
        createdAt: first.createdAt,
        userInitials: first.userInitials,
        userName: first.userName,
        userColor: first.userColor,
        action: FIELD_CHANGED,
        batchedItems: entry,
      });
    }
  }
  return result;
}
