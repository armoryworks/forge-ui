import { describe, it, expect, beforeEach } from 'vitest';
import { Component, Directive, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CapabilityService } from '../../../shared/services/capability.service';
import { CapabilityInstallStateService } from '../../../shared/services/capability-install-state.service';
import { ConsultantModeService } from '../../../shared/services/consultant-mode.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { CapabilityDescriptorEntry } from '../../../shared/models/capability-descriptor.model';
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
    TestBed.configureTestingModule({
      imports: [CapabilitiesComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: CapabilityService,
          useValue: {
            loading: signal(false),
            capabilities: signal([
              entry('CAP-ACCT-FULLGL', 'ACCT', 'Built-in full general ledger'),
              entry('CAP-O2C-SO', 'O2C', 'Sales orders'),
            ]),
            load: () => of(null),
          },
        },
        { provide: ConsultantModeService, useValue: { enabled: consultantMode, toggle: () => consultantMode.update((v) => !v) } },
        { provide: CapabilityInstallStateService, useValue: { dismissed: signal(true), dismiss: () => undefined } },
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
});
