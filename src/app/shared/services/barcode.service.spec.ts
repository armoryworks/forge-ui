import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { BarcodeInfo, BarcodeService } from './barcode.service';

const mockBarcode: BarcodeInfo = {
  id: 1,
  value: 'PART-0042',
  entityType: 'part',
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

describe('BarcodeService', () => {
  let service: BarcodeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BarcodeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getEntityBarcodes() ─────────────────────────────────────────────────────

  it('getEntityBarcodes() sends GET to the correct URL', () => {
    service.getEntityBarcodes('part', 42).subscribe();

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/barcodes`);
    expect(req.request.method).toBe('GET');
    req.flush([mockBarcode]);
  });

  it('getEntityBarcodes() sends entityType and entityId as query params', () => {
    service.getEntityBarcodes('part', 42).subscribe();

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/barcodes`);
    expect(req.request.params.get('entityType')).toBe('part');
    expect(req.request.params.get('entityId')).toBe('42');
    req.flush([mockBarcode]);
  });

  it('getEntityBarcodes() returns the array of BarcodeInfo from the API', () => {
    const mockList: BarcodeInfo[] = [mockBarcode, { ...mockBarcode, id: 2, value: 'PART-0043' }];

    let result: BarcodeInfo[] | undefined;
    service.getEntityBarcodes('part', 42).subscribe(r => (result = r));

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/barcodes`);
    req.flush(mockList);

    expect(result).toHaveLength(2);
    expect(result?.[0].value).toBe('PART-0042');
    expect(result?.[1].value).toBe('PART-0043');
  });

  it('getEntityBarcodes() encodes entityId as a string in query params', () => {
    service.getEntityBarcodes('asset', 999).subscribe();

    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/barcodes`);
    expect(req.request.params.get('entityId')).toBe('999');
    req.flush([]);
  });

  // ── regenerateBarcode() ─────────────────────────────────────────────────────

  it('regenerateBarcode() sends POST to the correct URL', () => {
    service.regenerateBarcode('part', 42, 'PART-0042').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/barcodes/regenerate`);
    expect(req.request.method).toBe('POST');
    req.flush(mockBarcode);
  });

  it('regenerateBarcode() sends the correct request body', () => {
    service.regenerateBarcode('part', 42, 'PART-0042').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/barcodes/regenerate`);
    expect(req.request.body).toEqual({
      entityType: 'part',
      entityId: 42,
      naturalIdentifier: 'PART-0042',
    });
    req.flush(mockBarcode);
  });

  it('regenerateBarcode() returns the new BarcodeInfo from the API', () => {
    const regenerated: BarcodeInfo = { ...mockBarcode, value: 'PART-0042-NEW' };

    let result: BarcodeInfo | undefined;
    service.regenerateBarcode('part', 42, 'PART-0042').subscribe(r => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/barcodes/regenerate`);
    req.flush(regenerated);

    expect(result?.value).toBe('PART-0042-NEW');
  });
});
