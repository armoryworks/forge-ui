import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { PortalLoginComponent } from './portal-login.component';
import { PortalService } from '../services/portal.service';

describe('PortalLoginComponent · submit', () => {
  it('requests one sign-in link when the form is submitted twice before the server answers', () => {
    const requestMagicLink = vi.fn(() => new Subject());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PortalService, useValue: { requestMagicLink } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const view = TestBed.runInInjectionContext(() => new PortalLoginComponent()) as unknown as {
      emailControl: FormControl<string>;
      submit(): void;
    };

    view.emailControl.setValue('buyer@example.com');
    view.submit();
    view.submit();

    expect(requestMagicLink).toHaveBeenCalledTimes(1);
  });
});
