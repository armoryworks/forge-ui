import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CapabilityService } from '../../../../shared/services/capability.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GlOpeningCalloutComponent } from './gl-opening-callout.component';

describe('GlOpeningCalloutComponent', () => {
  let migrationOn: boolean;
  let setEnabled: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  const capabilities = signal<unknown[]>([]);

  function render(roles: string[]): { fixture: ComponentFixture<GlOpeningCalloutComponent>; el: HTMLElement } {
    TestBed.configureTestingModule({
      imports: [GlOpeningCalloutComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: CapabilityService,
          useValue: { capabilities, isEnabled: () => migrationOn, setEnabled, load },
        },
        { provide: AuthService, useValue: { hasAnyRole: (r: string[]) => r.some((x) => roles.includes(x)) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(GlOpeningCalloutComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    migrationOn = false;
    setEnabled = vi.fn(() => {
      migrationOn = true;
      return of({});
    });
    load = vi.fn(() => {
      capabilities.set([]);
      return of(undefined);
    });
  });

  it('offers to turn on the migration wizard while it is off, and no journal link yet', () => {
    const { el } = render(['Admin', 'Controller']);

    expect(el.querySelector('[data-testid="gl-opening-enable-migration"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="gl-opening-open-journal"]')).toBeNull();
  });

  it('turns the wizard on, then links a controller to the opening journal', () => {
    const { fixture, el } = render(['Admin', 'Controller']);

    el.querySelector<HTMLButtonElement>('[data-testid="gl-opening-enable-migration"]')!.click();
    fixture.detectChanges();

    expect(setEnabled).toHaveBeenCalledWith('CAP-ACCT-MIGRATION', true);
    expect(load).toHaveBeenCalled();
    const link = el.querySelector<HTMLAnchorElement>('[data-testid="gl-opening-open-journal"]');
    expect(link?.getAttribute('href')).toBe('/accounting/opening-journal');
  });

  it('gives an admin without the Controller role the steps but no journal link', () => {
    migrationOn = true;
    const { el } = render(['Admin']);

    expect(el.querySelector('[data-testid="gl-opening-enable-migration"]')).toBeNull();
    expect(el.querySelector('[data-testid="gl-opening-open-journal"]')).toBeNull();
    expect(el.querySelector('[data-testid="gl-opening-step-journal"]')).not.toBeNull();
  });
});
