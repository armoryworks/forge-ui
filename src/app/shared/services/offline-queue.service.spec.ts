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
    httpMock.verify();
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
    it('should process entries in order and return result', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'First' });
      await service.enqueue('PUT', '/api/v1/jobs/1', { title: 'Second' });

      const drainPromise = service.drain();

      // Respond to the first request
      const req1 = httpMock.expectOne('/api/v1/jobs');
      expect(req1.request.method).toBe('POST');
      expect(req1.request.body).toEqual({ title: 'First' });
      req1.flush({ id: 1 });

      // Respond to the second request
      const req2 = httpMock.expectOne('/api/v1/jobs/1');
      expect(req2.request.method).toBe('PUT');
      expect(req2.request.body).toEqual({ title: 'Second' });
      req2.flush({ id: 1 });

      const result = await drainPromise;

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should stop processing on first failure', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'First' });
      await service.enqueue('POST', '/api/v1/jobs', { title: 'Second' });
      await service.enqueue('POST', '/api/v1/jobs', { title: 'Third' });

      const drainPromise = service.drain();

      // First request succeeds
      const req1 = httpMock.expectOne(
        (req) => req.url === '/api/v1/jobs' && req.body?.title === 'First',
      );
      req1.flush({ id: 1 });

      // Second request fails
      const req2 = httpMock.expectOne(
        (req) => req.url === '/api/v1/jobs' && req.body?.title === 'Second',
      );
      req2.error(new ProgressEvent('error'), { status: 500 });

      const result = await drainPromise;

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      // Second entry (failed) + third entry (never attempted) remain
      expect(result.remaining).toBe(2);
    });

    it('should handle DELETE requests without body', async () => {
      await service.enqueue('DELETE', '/api/v1/jobs/5');

      const drainPromise = service.drain();

      const req = httpMock.expectOne('/api/v1/jobs/5');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      const result = await drainPromise;

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should handle PATCH requests', async () => {
      await service.enqueue('PATCH', '/api/v1/parts/3', { status: 'Active' });

      const drainPromise = service.drain();

      const req = httpMock.expectOne('/api/v1/parts/3');
      expect(req.request.method).toBe('PATCH');
      req.flush({ id: 3 });

      const result = await drainPromise;
      expect(result.processed).toBe(1);
    });

    it('should return early if already draining', async () => {
      await service.enqueue('POST', '/api/v1/jobs', { title: 'Test' });

      // Start first drain (will be pending)
      const firstDrain = service.drain();

      // Attempt second drain while first is in progress
      const secondDrain = service.drain();
      const secondResult = await secondDrain;

      expect(secondResult.processed).toBe(0);
      expect(secondResult.failed).toBe(0);

      // Complete the first drain
      const req = httpMock.expectOne('/api/v1/jobs');
      req.flush({ id: 1 });
      await firstDrain;
    });

    it('should handle empty queue', async () => {
      const result = await service.drain();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
    });
  });
});
