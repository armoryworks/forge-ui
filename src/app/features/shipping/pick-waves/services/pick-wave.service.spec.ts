import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PickWaveService } from './pick-wave.service';

describe('PickWaveService', () => {
  let service: PickWaveService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PickWaveService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists waves filtered by status', () => {
    service.getWaves('Released').subscribe();
    const req = http.expectOne(r => r.url.endsWith('/pick-waves') && r.params.get('status') === 'Released');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('reads the caller\'s open lines', () => {
    service.getMyLines().subscribe();
    http.expectOne(r => r.url.endsWith('/pick-waves/my-lines')).flush([]);
  });

  it('confirms a line with the picked quantity', () => {
    service.confirmLine(4, 8, { pickedQuantity: 3, shortNotes: 'short' }).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/pick-waves/4/lines/8/confirm'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ pickedQuantity: 3, shortNotes: 'short' });
    req.flush(null);
  });

  it('releases, completes and auto-generates', () => {
    service.release(4).subscribe();
    service.complete(4).subscribe();
    service.autoGenerate({ strategy: 'Zone', maxLinesPerWave: 50 }).subscribe();
    http.expectOne(r => r.url.endsWith('/pick-waves/4/release')).flush(null);
    http.expectOne(r => r.url.endsWith('/pick-waves/4/complete')).flush(null);
    http.expectOne(r => r.url.endsWith('/pick-waves/auto-generate')).flush({});
  });
});
