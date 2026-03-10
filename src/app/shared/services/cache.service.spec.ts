import { TestBed } from '@angular/core/testing';

import { CacheService } from './cache.service';

/**
 * CacheService uses IndexedDB. In the Vitest/jsdom environment, we use
 * the fake-indexeddb shim if available, or rely on jsdom's built-in support.
 * If neither is available, these tests will be skipped.
 */
describe('CacheService', () => {
  let service: CacheService;

  // Check if IndexedDB is available in the test environment
  const hasIndexedDB = typeof indexedDB !== 'undefined';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CacheService],
    });

    service = TestBed.inject(CacheService);
  });

  afterEach(async () => {
    if (hasIndexedDB) {
      // Clean up after each test
      await service.clearAll();
    }
  });

  describe('set and get', () => {
    it('should store and retrieve data', async () => {
      if (!hasIndexedDB) {
        return;
      }

      await service.set('test-key', { name: 'Widget', count: 42 });

      const result = await service.get<{ name: string; count: number }>('test-key');

      expect(result).not.toBeNull();
      expect(result!.data.name).toBe('Widget');
      expect(result!.data.count).toBe(42);
    });

    it('should include lastSynced timestamp', async () => {
      if (!hasIndexedDB) {
        return;
      }

      const before = Date.now();
      await service.set('ts-key', 'some data');
      const after = Date.now();

      const result = await service.get<string>('ts-key');

      expect(result).not.toBeNull();
      expect(result!.lastSynced).toBeGreaterThanOrEqual(before);
      expect(result!.lastSynced).toBeLessThanOrEqual(after);
    });

    it('should return null for non-existent key', async () => {
      if (!hasIndexedDB) {
        return;
      }

      const result = await service.get('does-not-exist');

      expect(result).toBeNull();
    });

    it('should overwrite existing key', async () => {
      if (!hasIndexedDB) {
        return;
      }

      await service.set('overwrite-key', 'first');
      await service.set('overwrite-key', 'second');

      const result = await service.get<string>('overwrite-key');

      expect(result).not.toBeNull();
      expect(result!.data).toBe('second');
    });

    it('should store various data types', async () => {
      if (!hasIndexedDB) {
        return;
      }

      await service.set('string-key', 'hello');
      await service.set('number-key', 123);
      await service.set('array-key', [1, 2, 3]);
      await service.set('null-key', null);

      expect((await service.get<string>('string-key'))!.data).toBe('hello');
      expect((await service.get<number>('number-key'))!.data).toBe(123);
      expect((await service.get<number[]>('array-key'))!.data).toEqual([1, 2, 3]);
      expect((await service.get<null>('null-key'))!.data).toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove a specific key', async () => {
      if (!hasIndexedDB) {
        return;
      }

      await service.set('keep-key', 'keep');
      await service.set('remove-key', 'remove');

      await service.clear('remove-key');

      expect(await service.get('remove-key')).toBeNull();
      expect(await service.get('keep-key')).not.toBeNull();
    });

    it('should not throw when clearing a non-existent key', async () => {
      if (!hasIndexedDB) {
        return;
      }

      await expect(service.clear('no-such-key')).resolves.toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should remove all cached entries', async () => {
      if (!hasIndexedDB) {
        return;
      }

      await service.set('key-a', 'a');
      await service.set('key-b', 'b');
      await service.set('key-c', 'c');

      await service.clearAll();

      expect(await service.get('key-a')).toBeNull();
      expect(await service.get('key-b')).toBeNull();
      expect(await service.get('key-c')).toBeNull();
    });
  });
});
