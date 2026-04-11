import { TestBed } from '@angular/core/testing';

import { DraftStorageService } from './draft-storage.service';
import { Draft } from '../models/draft.model';

/**
 * DraftStorageService uses IndexedDB. In the Vitest/jsdom environment, we use
 * the fake-indexeddb shim if available, or rely on jsdom's built-in support.
 * If neither is available, these tests will be skipped.
 */
describe('DraftStorageService', () => {
  let service: DraftStorageService;

  const hasIndexedDB = typeof indexedDB !== 'undefined';

  const makeDraft = (overrides?: Partial<Draft>): Draft => ({
    key: '1:job:new',
    userId: 1,
    entityType: 'job',
    entityId: 'new',
    displayLabel: 'New Job',
    route: '/kanban',
    formData: { title: 'Test Job' },
    lastModified: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DraftStorageService],
    });

    service = TestBed.inject(DraftStorageService);
  });

  afterEach(async () => {
    if (hasIndexedDB) {
      // Clean up test drafts
      try {
        await service.delete('1:job:new');
        await service.delete('1:part:42');
      } catch {
        // Best-effort cleanup
      }
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  (hasIndexedDB ? it : it.skip)('get should return null for non-existent draft', async () => {
    const result = await service.get('nonexistent:key:here');

    expect(result).toBeNull();
  });

  (hasIndexedDB ? it : it.skip)('put and get should round-trip a draft', async () => {
    const draft = makeDraft();

    await service.put(draft);
    const result = await service.get('1:job:new');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('1:job:new');
    expect(result!.userId).toBe(1);
    expect(result!.entityType).toBe('job');
    expect(result!.entityId).toBe('new');
    expect(result!.displayLabel).toBe('New Job');
    expect(result!.formData).toEqual({ title: 'Test Job' });
  });

  (hasIndexedDB ? it : it.skip)('delete should remove a draft', async () => {
    const draft = makeDraft();
    await service.put(draft);

    await service.delete('1:job:new');
    const result = await service.get('1:job:new');

    expect(result).toBeNull();
  });

  (hasIndexedDB ? it : it.skip)('getByUser should return all drafts for a user', async () => {
    const draft1 = makeDraft({ key: '1:job:new', entityType: 'job' });
    const draft2 = makeDraft({ key: '1:part:42', entityType: 'part', entityId: '42', displayLabel: 'Edit Part' });

    await service.put(draft1);
    await service.put(draft2);

    const drafts = await service.getByUser(1);

    expect(drafts.length).toBe(2);
  });
});
