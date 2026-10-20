import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AuditLogPanelComponent } from './audit-log-panel.component';
import { AuditLogEntry } from '../../models/audit-log-entry.model';
import { SelectOption } from '../../../../shared/components/select/select.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PanelInternals {
  ngOnInit(): void;
  load(): void;
  entries: { (): AuditLogEntry[] };
  totalCount: { (): number };
  isLoading: { (): boolean };
  loadError: { (): string | null };
  entityTypeControl: FormControl<string>;
  entityTypeOptions: SelectOption[];
  expandedDetailsId: { (): number | null };
  toggleDetails(id: number): void;
  formatDetails(details: string | null): string;
}

const url = `${environment.apiUrl}/admin/audit-log`;

const entry: AuditLogEntry = {
  id: 1, userId: 7, userName: 'Pat Admin', action: 'JobCreated', entityType: 'Job',
  entityId: 42, details: null, ipAddress: null, createdAt: new Date('2026-10-01T00:00:00Z'),
};

function page(data: AuditLogEntry[]) {
  return { data, page: 1, pageSize: 25, totalCount: data.length, totalPages: 1 };
}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });
  const component = TestBed.runInInjectionContext(() => new AuditLogPanelComponent()) as unknown as PanelInternals;
  const httpMock = TestBed.inject(HttpTestingController);
  return { component, httpMock };
}

function expectAuditRequest(httpMock: HttpTestingController): TestRequest {
  return httpMock.expectOne(r => r.url === url);
}

describe('AuditLogPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends only page and pageSize when no filter is set', () => {
    const { component, httpMock } = setup();

    component.ngOnInit();

    const req = expectAuditRequest(httpMock);
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('25');
    req.flush(page([entry]));

    expect(component.entries()).toEqual([entry]);
    expect(component.totalCount()).toBe(1);
    expect(component.loadError()).toBeNull();
  });

  it('labels rows written by background work as the system actor', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();

    expectAuditRequest(httpMock).flush(page([entry, { ...entry, id: 2, userId: 0, userName: '' }]));

    expect(component.entries().map(e => e.userName)).toEqual(['Pat Admin', 'adminPanels.auditLog.systemActor']);
  });

  it('adds the entity type once one is picked', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    expectAuditRequest(httpMock).flush(page([]));

    component.entityTypeControl.setValue('Job');

    const req = expectAuditRequest(httpMock);
    expect(req.request.params.get('entityType')).toBe('Job');
    expect(req.request.params.keys().sort()).toEqual(['entityType', 'page', 'pageSize']);
    req.flush(page([entry]));
    expect(component.entries()).toEqual([entry]);
  });

  it('shows the server message instead of an empty list when the load fails, and retries', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();

    expectAuditRequest(httpMock).flush(
      { title: 'Bad Request', detail: 'The value is not valid for from.' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.loadError()).toBe('The value is not valid for from.');
    expect(component.entries()).toEqual([]);
    expect(component.isLoading()).toBe(false);

    component.load();
    expect(component.loadError()).toBeNull();
    expectAuditRequest(httpMock).flush(page([entry]));
    expect(component.entries()).toEqual([entry]);
  });

  it('offers the quality and inventory record types as filters', () => {
    const { component } = setup();

    const values = component.entityTypeOptions.map(o => o.value);

    expect(values).toEqual(expect.arrayContaining([
      'QcInspection', 'NonConformance', 'CorrectiveAction', 'Gage', 'EngineeringChangeOrder',
      'LotRecord', 'SerialNumber', 'StorageLocation', 'CycleCount',
    ]));
  });

  it('expands one row of details at a time and collapses it on a second click', () => {
    const { component } = setup();

    component.toggleDetails(1);
    expect(component.expandedDetailsId()).toBe(1);
    component.toggleDetails(2);
    expect(component.expandedDetailsId()).toBe(2);
    component.toggleDetails(2);
    expect(component.expandedDetailsId()).toBeNull();
  });

  it('pretty-prints JSON details and shows any other text as it is', () => {
    const { component } = setup();

    expect(component.formatDetails('{"from":"Draft","to":"Posted"}')).toBe('{\n  "from": "Draft",\n  "to": "Posted"\n}');
    expect(component.formatDetails('Status changed to Posted')).toBe('Status changed to Posted');
    expect(component.formatDetails(null)).toBe('');
  });
});
