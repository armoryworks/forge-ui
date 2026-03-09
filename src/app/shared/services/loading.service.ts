import { Injectable, signal, computed } from '@angular/core';
import { Observable, finalize } from 'rxjs';

export interface LoadingCause {
  key: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _causes = signal<LoadingCause[]>([]);

  readonly causes = this._causes.asReadonly();
  readonly isLoading = computed(() => this._causes().length > 0);
  readonly message = computed(() => {
    const causes = this._causes();
    return causes.length ? causes[causes.length - 1].message : '';
  });

  /**
   * Track an Observable — automatically starts/clears loading state.
   * Usage: `this.loading.track('Loading jobs...', this.jobService.getJobs())`
   */
  track<T>(message: string, source: Observable<T>): Observable<T> {
    const key = `${message}_${Date.now()}`;
    this.start(key, message);

    return source.pipe(
      finalize(() => this.stop(key)),
    );
  }

  /**
   * Track a Promise — automatically starts/clears loading state.
   */
  async trackPromise<T>(message: string, promise: Promise<T>): Promise<T> {
    const key = `${message}_${Date.now()}`;
    this.start(key, message);

    try {
      return await promise;
    } finally {
      this.stop(key);
    }
  }

  /**
   * Manually start a loading cause. Call stop(key) when done.
   */
  start(key: string, message: string): void {
    this._causes.update(causes => {
      // Replace existing key or append
      const filtered = causes.filter(c => c.key !== key);
      return [...filtered, { key, message }];
    });
  }

  /**
   * Remove a loading cause by key.
   */
  stop(key: string): void {
    this._causes.update(causes => causes.filter(c => c.key !== key));
  }

  /**
   * Clear all loading causes.
   */
  clear(): void {
    this._causes.set([]);
  }
}
