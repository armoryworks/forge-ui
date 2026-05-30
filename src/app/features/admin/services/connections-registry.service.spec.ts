import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ConnectionsRegistryService } from './connections-registry.service';
import { IntegrationRecord } from '../models/integration-record.model';
import { environment } from '../../../../environments/environment';

describe('ConnectionsRegistryService', () => {
  let service: ConnectionsRegistryService;
  let httpMock: HttpTestingController;

  const url = `${environment.apiUrl}/admin/connections`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConnectionsRegistryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs /admin/connections and returns the federated row set', () => {
    const mock: IntegrationRecord[] = [
      {
        kind: 'SystemApiKey', sourceId: '7', name: 'Tuyere',
        ownerEmail: 'tuyere-cms@forge.local', status: 'Active',
        lastUsedAt: null, createdAt: '2026-05-30T00:00:00Z',
        manageRoute: '/admin/system-api-keys',
      },
      {
        kind: 'QuickBooksOAuth', sourceId: 'qb_oauth_token',
        name: 'QuickBooks Online', ownerEmail: null, status: 'Connected',
        lastUsedAt: null, createdAt: null,
        manageRoute: '/admin/integrations',
      },
    ];
    let result: IntegrationRecord[] = [];

    service.list().subscribe((rows) => { result = rows; });
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush(mock);

    expect(result.length).toBe(2);
    expect(result[0].kind).toBe('SystemApiKey');
    expect(result[1].createdAt).toBeNull();
  });
});
