import { describe, it, expect, beforeEach } from 'vitest';
import { Component, Directive, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CapabilityService } from '../../../shared/services/capability.service';
import { CapabilityInstallStateService } from '../../../shared/services/capability-install-state.service';
import { ConsultantModeService } from '../../../shared/services/consultant-mode.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { CapabilityDescriptor, CapabilityDescriptorEntry } from '../../../shared/models/capability-descriptor.model';
import { CapabilitiesComponent } from './capabilities.component';

@Component({
  selector: 'app-page-layout',
  standalone: true,
  template: '<ng-content select="[toolbar]" /><ng-content select="[content]" />',
})
class StubPageLayoutComponent {
  readonly pageTitle = input('');
  readonly pageSubtitle = input('');
}

@Directive({ selector: '[appLoadingBlock]', standalone: true })
class StubLoadingBlockDirective {
  readonly appLoadingBlock = input<boolean>(false);
}

function entry(code: string, area: string, name: string): CapabilityDescriptorEntry {
  return {
    id: code, code, area, name, description: '', enabled: true, isDefaultOn: true, requiresRoles: null,
    version: 1, eTag: 'W/"1"', configVersion: null, configETag: null, configId: null, dependencies: [], mutexes: [],
  };
}

describe('CapabilitiesComponent', () => {
  let fixture: ComponentFixture<CapabilitiesComponent>;
  let consultantMode: ReturnType<typeof signal<boolean>>;
  let descriptor: ReturnType<typeof signal<CapabilityDescriptor | null>>;
  let bannerDismissed: ReturnType<typeof signal<boolean>>;

  function render(): HTMLElement {
    fixture = TestBed.createComponent(CapabilitiesComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function search(text: string): void {
    const component = fixture.componentInstance as unknown as { searchControl: { setValue(v: string): void } };
    component.searchControl.setValue(text);
    fixture.detectChanges();
  }

  beforeEach(() => {
    consultantMode = signal(false);
    descriptor = signal<CapabilityDescriptor | null>(null);
    bannerDismissed = signal(true);
    TestBed.configureTestingModule({
      imports: [CapabilitiesComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: CapabilityService,
          useValue: {
            loading: signal(false),
            descriptor,
            capabilities: signal([
              entry('CAP-ACCT-FULLGL', 'ACCT', 'Built-in full general ledger'),
              entry('CAP-O2C-SO', 'O2C', 'Sales orders'),
              { ...entry('CAP-QC-COA', 'O2C', 'Certificate of analysis (lot)'), enabled: false, isAvailable: false },
            ]),
            load: () => of(null),
          },
        },
        { provide: ConsultantModeService, useValue: { enabled: consultantMode, toggle: () => consultantMode.update((v) => !v) } },
        { provide: CapabilityInstallStateService, useValue: { dismissed: bannerDismissed, dismiss: () => undefined } },
        { provide: SnackbarService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    });
    TestBed.overrideComponent(CapabilitiesComponent, {
      remove: { imports: [PageLayoutComponent, LoadingBlockDirective] },
      add: { imports: [StubPageLayoutComponent, StubLoadingBlockDirective] },
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      capabilityAreas: {
        allAreas: 'All areas',
        areas: { accounting: 'Accounting', sales: 'Sales' },
        settingsSearch: { tag: 'Settings', numberingTitle: 'Numbering', numberingDesc: 'type your own numbers' },
      },
    });
    translate.use('en');
  });

  it('names each area header in words and hides the area code', () => {
    const el = render();
    const names = Array.from(el.querySelectorAll('.capability-area__name')).map((n) => n.textContent?.trim());

    expect(names).toEqual(['Accounting', 'Sales']);
    expect(el.querySelector('[data-testid="capability-area-code"]')).toBeNull();
  });

  it('shows the raw area code beside the name in consultant mode', () => {
    consultantMode.set(true);
    const el = render();
    const codes = Array.from(el.querySelectorAll('[data-testid="capability-area-code"]')).map((n) => n.textContent?.trim());

    expect(codes).toEqual(['ACCT', 'O2C']);
  });

  it('disables the toggle of a capability that is not built yet', () => {
    const el = render();
    const toggleButton = (code: string) =>
      el.querySelector<HTMLButtonElement>(`[data-cap-code="${code}"] [data-testid="capability-toggle"] button`);

    expect(toggleButton('CAP-QC-COA')!.disabled).toBe(true);
    expect(toggleButton('CAP-O2C-SO')!.disabled).toBe(false);
  });

  it('links a number search to the Numbering settings, highlighted', () => {
    const el = render();
    search('number');

    const link = el.querySelector<HTMLAnchorElement>('[data-testid="capability-settings-result-numbering"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/admin/settings?highlight=numbering');
    expect(link!.textContent).toContain('Numbering');
  });

  it('shows no settings row when the search matches no settings topic', () => {
    const el = render();
    search('ledger');

    expect(el.querySelector('[data-testid="capability-settings-results"]')).toBeNull();
  });

  describe('onboarding banner', () => {
    const descriptorWith = (onboardingComplete: boolean): CapabilityDescriptor =>
      ({ generatedAt: '2026-10-19T00:00:00Z', totalCount: 3, enabledCount: 2, capabilities: [], onboardingComplete });
    const banner = (el: HTMLElement) => el.querySelector('[data-testid="capability-onboarding-banner"]');

    it('shows on an install the server reports as not yet onboarded', () => {
      bannerDismissed.set(false);
      descriptor.set(descriptorWith(false));

      expect(banner(render())).not.toBeNull();
    });

    it('stays hidden once the server reports a preset applied or discovery run, even without a local dismissal', () => {
      bannerDismissed.set(false);
      descriptor.set(descriptorWith(true));

      expect(banner(render())).toBeNull();
    });

    it('stays hidden after the user skips it on this browser', () => {
      bannerDismissed.set(true);
      descriptor.set(descriptorWith(false));

      expect(banner(render())).toBeNull();
    });

    it('does not flash before the descriptor has loaded', () => {
      bannerDismissed.set(false);

      expect(banner(render())).toBeNull();
    });
  });
});

describe('CapabilitiesComponent toggles', () => {
  type ToggleInternals = {
    onToggle(entry: CapabilityDescriptorEntry, target: boolean, toggle?: { checked: boolean }): void;
    glOpeningReason(): string | null;
  };
  let setEnabled: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  const fullGl = { ...entry('CAP-ACCT-FULLGL', 'ACCT', 'Built-in full general ledger'), enabled: false };

  function component(): ToggleInternals {
    TestBed.configureTestingModule({
      imports: [CapabilitiesComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: CapabilityService,
          useValue: { loading: signal(false), descriptor: signal(null), capabilities: signal([fullGl]), load, setEnabled, isEnabled: () => false },
        },
        { provide: ConsultantModeService, useValue: { enabled: signal(false), toggle: () => undefined } },
        { provide: CapabilityInstallStateService, useValue: { dismissed: signal(true), dismiss: () => undefined } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new CapabilitiesComponent()) as unknown as ToggleInternals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    load = vi.fn(() => of(undefined));
  });

  it('puts a refused toggle back to the saved state so the next click retries the enable', () => {
    setEnabled = vi.fn(() => throwError(() => new HttpErrorResponse({
      status: 409,
      error: { errors: [{ code: 'capability-missing-dependencies', message: 'x', missing: ['CAP-ACCT-BUILTIN'] }] },
    })));
    const c = component();
    const toggle = { checked: true };

    c.onToggle(fullGl, true, toggle);

    expect(toggle.checked).toBe(false);
    expect(load).toHaveBeenCalled();
  });

  it('opens the opening-journal callout when full GL waits on an opening journal', () => {
    setEnabled = vi.fn(() => throwError(() => new HttpErrorResponse({
      status: 409,
      error: { errors: [{ code: 'capability-gl-opening-balances', message: 'Load the opening journal first.' }] },
    })));
    const c = component();

    c.onToggle(fullGl, true, { checked: true });

    expect(c.glOpeningReason()).toBe('Load the opening journal first.');
  });

  it('reloads the descriptor after a successful toggle so cascaded capabilities show', () => {
    setEnabled = vi.fn(() => of({ ...fullGl, enabled: true }));
    const c = component();

    c.onToggle(fullGl, true, { checked: true });

    expect(setEnabled).toHaveBeenCalledWith('CAP-ACCT-FULLGL', true);
    expect(load).toHaveBeenCalled();
    expect(c.glOpeningReason()).toBeNull();
  });
});
