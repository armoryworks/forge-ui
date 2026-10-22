import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { WorkerComponent } from './worker.component';
import { WorkerService } from './services/worker.service';
import { AuthService } from '../../shared/services/auth.service';

interface WorkerInternals {
  loading: () => boolean;
  loadFailed: () => boolean;
  loadTasks: () => void;
}

describe('WorkerComponent', () => {
  const getMyTasks = vi.fn();

  function create(): WorkerInternals {
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkerService, useValue: { getMyTasks } },
        { provide: AuthService, useValue: { user: signal({ id: 5, firstName: 'Pat', lastName: 'Doe' }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    return TestBed.runInInjectionContext(() => new WorkerComponent()) as unknown as WorkerInternals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    getMyTasks.mockReset();
  });

  it('says the tasks could not load instead of showing an empty list', () => {
    getMyTasks.mockReturnValue(throwError(() => new Error('500')));

    const c = create();

    expect(c.loading()).toBe(false);
    expect(c.loadFailed()).toBe(true);
  });

  it('clears the failure once a refresh succeeds', () => {
    getMyTasks.mockReturnValueOnce(throwError(() => new Error('500'))).mockReturnValueOnce(of([]));
    const c = create();

    c.loadTasks();

    expect(c.loadFailed()).toBe(false);
  });
});
