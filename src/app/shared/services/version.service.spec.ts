import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AppVersion, VersionService } from './version.service';

describe('VersionService', () => {
  let service: VersionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VersionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('load() sets the local version from the bundled version file', () => {
    const mockVersion: AppVersion = { version: '1.2.3', sha: 'abc1234' };

    service.load();

    const versionReq = httpMock.expectOne('/assets/version.json');
    expect(versionReq.request.method).toBe('GET');
    versionReq.flush(mockVersion);

    expect(service.local()).toEqual(mockVersion);
  });

  it('load() makes no request outside the install', () => {
    service.load();

    httpMock.expectOne('/assets/version.json').flush({ version: '1.2.3', sha: 'abc1234' });

    httpMock.expectNone(req => /^https?:\/\//i.test(req.url));
  });

  it('load() shortens a full 40-char SHA to 7 chars', () => {
    service.load();

    httpMock.expectOne('/assets/version.json').flush({ version: '0.0.6', sha: '8b07eb5bc23175111adb8ae3d8d397659a8d3a7' });

    expect(service.local()?.sha).toBe('8b07eb5');
  });

  it('load() leaves the literal "dev" SHA untouched', () => {
    service.load();

    httpMock.expectOne('/assets/version.json').flush({ version: '0.0.0', sha: 'dev' });

    expect(service.local()?.sha).toBe('dev');
  });

  it('load() sets local to null when the version file is missing', () => {
    service.load();

    httpMock.expectOne('/assets/version.json').flush('Not found', { status: 404, statusText: 'Not Found' });

    expect(service.local()).toBeNull();
  });

  it('loadServer() reads the running API build once', () => {
    service.loadServer();
    httpMock.expectOne(req => req.url.endsWith('/version')).flush({ version: '0.9.1', gitCommit: 'abcdef0123', shortCommit: 'abcdef0', buildLabel: '0.9.1 (abcdef0)' });
    expect(service.server()?.buildLabel).toBe('0.9.1 (abcdef0)');

    service.loadServer();
    httpMock.expectNone(req => req.url.endsWith('/version'));
  });

  it('loadServer() leaves the server version empty when the API cannot be reached', () => {
    service.loadServer();
    httpMock.expectOne(req => req.url.endsWith('/version')).flush('down', { status: 503, statusText: 'Unavailable' });
    expect(service.server()).toBeNull();
  });
});
