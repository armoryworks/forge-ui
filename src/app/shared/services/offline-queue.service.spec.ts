import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { OfflineQueueService } from './offline-queue.service';

// Use fake-indexeddb for test environment
import 'fake-indexeddb/auto';

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(OfflineQueueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    await service.clearQueue();
    // Discard any pending requests from drain operations
    httpMock.match(() => true);
  });

  describe('enqueue', () => {
    it('should add an entry to the queue and update queueSize', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'Test' });

      expect(service.queueSize()).toBe(1);
    });

    it('should increment queueSize for multiple entries', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'Job 1' });
      await service.enqueue('PUT', '/api/v1/jobs/1', { title: 'Job 1 Updated' });
      await service.enqueue('DELETE', '/api/v1/jobs/2');

      expect(service.queueSize()).toBe(3);
    });

    it('should store entries with correct method and url', async () => {
      await service.enqueue('PATCH', '/api/v1/parts/5', { status: 'Active' });

      const size = await service.getQueueSize();
      expect(size).toBe(1);
    });

    it('should handle null body', async () => {
      await service.enqueue('DELETE', '/api/v1/jobs/1');

      expect(service.queueSize()).toBe(1);
    });
  });

  describe('getQueueSize', () => {
    it('should return 0 for an empty queue', async () => {
      const size = await service.getQueueSize();

      expect(size).toBe(0);
    });

    it('should return correct count after enqueue operations', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'A' });
      await service.enqueue('POST', '/api/v1/jobs', { title: 'B' });

      const size = await service.getQueueSize();
      expect(size).toBe(2);
    });
  });

  describe('clearQueue', () => {
    it('should empty the queue', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'A' });
      await service.enqueue('POST', '/api/v1/jobs', { title: 'B' });

      expect(service.queueSize()).toBe(2);

      await service.clearQueue();

      expect(service.queueSize()).toBe(0);
    });

    it('should handle clearing an already empty queue', async () => {
      await service.clearQueue();

      expect(service.queueSize()).toBe(0);
    });
  });

  describe('drain', () => {
    it('should return result for empty queue', async () => {
      const result = await service.drain();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should process a single POST entry', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'Test' });

      const drainPromise = service.drain();

      // Wait a tick for IndexedDB read to complete before HTTP fires
      await vi.waitFor(() => {
        httpMock.expectOne('/api/v1/jobs').flush({ id: 1 });
      }, { timeout: 2000 });

      const result = await drainPromise;

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should process a DELETE request without body', async () => {
      await service.enqueue('DELETE', '/api/v1/jobs/5');

      const drainPromise = service.drain();

      await vi.waitFor(() => {
        const req = httpMock.expectOne('/api/v1/jobs/5');
        expect(req.request.method).toBe('DELETE');
        req.flush(null, { status: 204, statusText: 'No Content' });
      }, { timeout: 2000 });

      const result = await drainPromise;

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should process a PATCH request', async () => {
      await service.enqueue('PATCH', '/api/v1/parts/3', { status: 'Active' });

      const drainPromise = service.drain();

      await vi.waitFor(() => {
        const req = httpMock.expectOne('/api/v1/parts/3');
        expect(req.request.method).toBe('PATCH');
        req.flush({ id: 3 });
      }, { timeout: 2000 });

      const result = await drainPromise;
      expect(result.processed).toBe(1);
    });

    it('should return early if already draining', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'Test' });

      // Start first drain (will be pending on HTTP)
      const firstDrain = service.drain();

      // Give first drain time to start
      await new Promise(r => setTimeout(r, 50));

      // Second drain should return early
      const secondResult = await service.drain();
      expect(secondResult.processed).toBe(0);

      // Complete the first drain
      await vi.waitFor(() => {
        httpMock.expectOne('/api/v1/jobs').flush({ id: 1 });
      }, { timeout: 2000 });

      await firstDrain;
    });
  });
});
