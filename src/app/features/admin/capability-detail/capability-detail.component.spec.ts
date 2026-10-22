import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CapabilityService } from '../../../shared/services/capability.service';
import { ConsultantModeService } from '../../../shared/services/consultant-mode.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { CapabilityDetailComponent } from './capability-detail.component';

describe('CapabilityDetailComponent · unknown code', () => {
  const descriptor = signal<object | null>(null);

  function create(code: string) {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: code })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: CapabilityService,
          useValue: { descriptor, getEntry: (c: string) => (c === 'CAP-REAL' ? { code: c } : undefined), load: () => of(undefined) },
        },
        { provide: ConsultantModeService, useValue: { enabled: signal(false) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new CapabilityDetailComponent()) as unknown as { notFound(): boolean };
  }

  beforeEach(() => descriptor.set(null));

  it('keeps loading while the descriptor has not arrived', () => {
    expect(create('CAP-NOPE-999').notFound()).toBe(false);
  });

  it('says not found once the descriptor has no such code', () => {
    const view = create('CAP-NOPE-999');
    descriptor.set({});
    expect(view.notFound()).toBe(true);
  });

  it('shows a known capability', () => {
    const view = create('CAP-REAL');
    descriptor.set({});
    expect(view.notFound()).toBe(false);
  });
});
