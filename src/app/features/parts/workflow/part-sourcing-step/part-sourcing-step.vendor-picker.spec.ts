import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';

import { PartSourcingStepComponent } from './part-sourcing-step.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function render(roles: string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideNoopAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: AuthService, useValue: { user: () => null, hasAnyRole: (allowed: string[]) => allowed.some(r => roles.includes(r)) } },
    ],
  });
  const fixture = TestBed.createComponent(PartSourcingStepComponent);
  fixture.detectChanges();
  const picker = fixture.debugElement.query(By.directive(EntityPickerComponent)).componentInstance as EntityPickerComponent;
  return { picker, http: TestBed.inject(HttpTestingController) };
}

describe('PartSourcingStepComponent preferred-vendor picker', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('searches the vendor lookup, which an engineer may read', () => {
    const { picker, http } = render(['Engineer']);

    (picker as unknown as { search(term: string): Observable<unknown[]> }).search('ano').subscribe();

    const req = http.expectOne(r => r.url === '/api/v1/vendors/lookup');
    expect(req.request.params.get('q')).toBe('ano');
    req.flush([{ id: 4, name: 'Anodize Works', code: 'V-100' }]);
    expect(picker.displayField()).toBe('name');
    expect(picker.secondaryDisplayField()).toBe('code');
  });

  it('hides inline vendor create from a role that cannot create vendors', () => {
    expect(render(['Engineer']).picker.createNewLabel()).toBeNull();
  });

  it('offers inline vendor create to the vendor-master roles', () => {
    expect(render(['Procurement']).picker.createNewLabel()).toBeTruthy();
  });
});
