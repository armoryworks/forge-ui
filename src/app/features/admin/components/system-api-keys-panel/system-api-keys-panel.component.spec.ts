import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SystemApiKeysPanelComponent } from './system-api-keys-panel.component';
import { CreateSystemApiKeyResponse, SystemApiKey } from '../../models/system-api-key.model';
import { SelectOption } from '../../../../shared/components/select/select.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PanelInternals {
  ngOnInit(): void;
  load(): void;
  submitCreate(): void;
  openCreate(): void;
  closeCreate(): void;
  dismissIssuedKey(): void;
  form: {
    invalid: boolean;
    patchValue(v: unknown): void;
  };
  keys: { (): SystemApiKey[] };
  issuedKey: { (): CreateSystemApiKeyResponse | null };
  isLoading: { (): boolean };
  showCreateDialog: { (): boolean };
  roleTemplateOptions: { (): SelectOption[] };
}

const base = `${environment.apiUrl}/admin/system-api-keys`;
const usersUrl = `${environment.apiUrl}/admin/users`;
const templatesUrl = `${environment.apiUrl}/admin/role-templates`;

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });
  const component = TestBed.runInInjectionContext(() => new SystemApiKeysPanelComponent());
  const httpMock = TestBed.inject(HttpTestingController);
  return { component: component as unknown as PanelInternals, httpMock };
}

describe('SystemApiKeysPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('GETs /admin/system-api-keys on load() and populates the keys signal', () => {
    const { component, httpMock } = setup();
    const fixture: SystemApiKey[] = [{
      id: 1, name: 'Tuyere', keyPrefix: 'fsk_aaaa', userId: 7,
      userEmail: 'tuyere-cms@forge.local', isActive: true,
      lastUsedAt: null, expiresAt: null, scopes: null, allowedIps: null,
      createdAt: '2026-05-30T00:00:00Z',
      roleTemplateId: null, roleTemplateName: null,
    }];
    component.load();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush(fixture);
    expect(component.keys()).toHaveLength(1);
    expect(component.keys()[0].userEmail).toBe('tuyere-cms@forge.local');
    httpMock.verify();
  });

  it('submitCreate does NOT POST while the form is invalid (Name + User required)', () => {
    const { component, httpMock } = setup();
    // An empty form must guard against accidental submit.
    expect(component.form.invalid).toBe(true);
    // Only the name — userId still missing. SystemApiKey audit attribution
    // depends on a bound user, so userId being required is non-negotiable.
    component.form.patchValue({ name: 'Tuyere', userId: null });
    expect(component.form.invalid).toBe(true);
    component.submitCreate();
    httpMock.expectNone(base);
    httpMock.verify();
  });

  it('forwards roleTemplateId in the POST body when one is picked', () => {
    const { component, httpMock } = setup();
    component.form.patchValue({
      name: 'Tuyere',
      userId: 7,
      roleTemplateId: 3,
      expiresAt: null,
    });
    expect(component.form.invalid).toBe(false);

    component.submitCreate();
    const createReq = httpMock.expectOne((req) =>
      req.method === 'POST' && req.url === base);
    expect(createReq.request.body).toMatchObject({
      name: 'Tuyere',
      userId: 7,
      roleTemplateId: 3,
    });
    const response: CreateSystemApiKeyResponse = {
      id: 99, name: 'Tuyere', keyPrefix: 'fsk_zz',
      plaintextKey: 'fsk_zzAAAABBBBCCCCDDDD', userId: 7, expiresAt: null,
    };
    createReq.flush(response);

    // Component does a follow-up load() after issuance.
    const listReq = httpMock.expectOne(base);
    listReq.flush([]);

    expect(component.issuedKey()?.plaintextKey).toBe('fsk_zzAAAABBBBCCCCDDDD');
    httpMock.verify();
  });

  it('role-template picker prepends a "None — inherit user roles" option', () => {
    const { component, httpMock } = setup();
    // TestBed.runInInjectionContext only runs the constructor — ngOnInit
    // is the entry point that fires the list + picker requests, so invoke
    // it explicitly to reproduce the post-mount HTTP state.
    component.ngOnInit();
    httpMock.expectOne(base).flush([]);
    httpMock.expectOne(usersUrl).flush([]);
    httpMock.expectOne(templatesUrl).flush([
      { id: 1, name: 'Read-only', includedRoleNames: ['Engineer'] },
      { id: 2, name: 'Procurement', includedRoleNames: ['OfficeManager'] },
    ]);

    const opts = component.roleTemplateOptions();
    expect(opts.length).toBe(3);
    // The "None" sentinel must be value: null so it round-trips as "no
    // template" — leaving the field unbound on the request payload.
    expect(opts[0].value).toBeNull();
    httpMock.verify();
  });
});
