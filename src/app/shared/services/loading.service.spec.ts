import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoadingService],
    });

    service = TestBed.inject(LoadingService);
  });

  describe('initial state', () => {
    it('should not be loading initially', () => {
      expect(service.isLoading()).toBe(false);
    });

    it('should have empty message initially', () => {
      expect(service.message()).toBe('');
    });

    it('should have empty causes initially', () => {
      expect(service.causes()).toEqual([]);
    });
  });

  describe('start and stop', () => {
    it('should set isLoading to true when a cause is started', () => {
      service.start('load-jobs', 'Loading jobs...');

      expect(service.isLoading()).toBe(true);
      expect(service.message()).toBe('Loading jobs...');
    });

    it('should set isLoading to false when the cause is stopped', () => {
      service.start('load-jobs', 'Loading jobs...');
      service.stop('load-jobs');

      expect(service.isLoading()).toBe(false);
      expect(service.message()).toBe('');
    });

    it('should support multiple concurrent causes', () => {
      service.start('load-jobs', 'Loading jobs...');
      service.start('load-parts', 'Loading parts...');

      expect(service.isLoading()).toBe(true);
      expect(service.causes().length).toBe(2);
    });

    it('should show the most recent cause message', () => {
      service.start('load-jobs', 'Loading jobs...');
      service.start('load-parts', 'Loading parts...');

      expect(service.message()).toBe('Loading parts...');
    });

    it('should remain loading until all causes are stopped', () => {
      service.start('load-jobs', 'Loading jobs...');
      service.start('load-parts', 'Loading parts...');

      service.stop('load-parts');

      expect(service.isLoading()).toBe(true);
      expect(service.message()).toBe('Loading jobs...');

      service.stop('load-jobs');

      expect(service.isLoading()).toBe(false);
    });

    it('should replace existing cause with same key', () => {
      service.start('load-data', 'Loading...');
      service.start('load-data', 'Still loading...');

      expect(service.causes().length).toBe(1);
      expect(service.message()).toBe('Still loading...');
    });

    it('should handle stopping a non-existent key gracefully', () => {
      service.stop('does-not-exist');

      expect(service.isLoading()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all causes', () => {
      service.start('a', 'A');
      service.start('b', 'B');
      service.start('c', 'C');

      service.clear();

      expect(service.isLoading()).toBe(false);
      expect(service.causes()).toEqual([]);
    });
  });

  describe('track', () => {
    it('should start loading immediately when track is called', () => {
      const source$ = new Subject<string>();

      // track() eagerly starts loading (before subscription)
      const tracked$ = service.track('Fetching data...', source$);

      expect(service.isLoading()).toBe(true);

      tracked$.subscribe();

      expect(service.isLoading()).toBe(true);
    });

    it('should stop loading when observable completes', () => {
      const source$ = new Subject<string>();

      service.track('Fetching data...', source$).subscribe();

      expect(service.isLoading()).toBe(true);

      source$.next('result');
      source$.complete();

      expect(service.isLoading()).toBe(false);
    });

    it('should stop loading when observable errors', () => {
      const source$ = new Subject<string>();

      service.track('Fetching data...', source$).subscribe({
        error: () => {
          // expected error
        },
      });

      expect(service.isLoading()).toBe(true);

      source$.error(new Error('fail'));

      expect(service.isLoading()).toBe(false);
    });

    it('should pass through emitted values', () => {
      const source$ = new Subject<number>();
      const results: number[] = [];

      service.track('Loading...', source$).subscribe((value) => {
        results.push(value);
      });

      source$.next(1);
      source$.next(2);
      source$.next(3);
      source$.complete();

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('trackPromise', () => {
    it('should start and stop loading around a resolved promise', async () => {
      const result = await service.trackPromise('Saving...', Promise.resolve('done'));

      expect(result).toBe('done');
      expect(service.isLoading()).toBe(false);
    });

    it('should stop loading even when promise rejects', async () => {
      await expect(
        service.trackPromise('Saving...', Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');

      expect(service.isLoading()).toBe(false);
    });
  });
});
