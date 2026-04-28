import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { PresetService } from './preset.service';
import {
  PresetApplyPreview,
  PresetApplyResult,
  PresetCompareResponse,
  PresetCustomPreview,
  PresetDetail,
  PresetSummary,
} from '../models/preset.model';

const BASE = environment.apiUrl;

describe('PresetService', () => {
  let service: PresetService;
  let httpMock: HttpTestingController;

  const sampleSummaries: PresetSummary[] = [
    {
      id: 'PRESET-01',
      name: 'Two-Person Shop',
      shortDescription: 'Owner-operator',
      targetProfile: '1-3 people',
      capabilityCount: 41,
      isCustom: false,
      isActive: false,
      recommendedFor: ['1-3 people'],
    },
    {
      id: 'PRESET-CUSTOM',
      name: 'Custom',
      shortDescription: 'Pick your own',
      targetProfile: 'Any',
      capabilityCount: 41,
      isCustom: true,
      isActive: false,
      recommendedFor: ['Hand-pick'],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PresetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loadPresets calls GET /presets and stores result in signal', () => {
    service.loadPresets().subscribe();
    const req = httpMock.expectOne(`${BASE}/presets`);
    expect(req.request.method).toBe('GET');
    req.flush(sampleSummaries);

    expect(service.presets()).toHaveLength(2);
    expect(service.presets()[0].id).toBe('PRESET-01');
    expect(service.loading()).toBe(false);
  });

  it('getPreset calls GET /presets/{id} and stores selected', () => {
    const detail: PresetDetail = {
      id: 'PRESET-04',
      name: 'Production Manufacturer',
      shortDescription: 'desc',
      targetProfile: '25-200',
      capabilityCount: 60,
      isCustom: false,
      isActive: false,
      recommendedFor: ['25-200 people'],
      capabilities: [],
      deltaVsCatalogDefaults: [],
      deltaVsCurrentInstall: [],
    };
    service.getPreset('PRESET-04').subscribe();
    const req = httpMock.expectOne(`${BASE}/presets/PRESET-04`);
    expect(req.request.method).toBe('GET');
    req.flush(detail);

    expect(service.selected()?.id).toBe('PRESET-04');
  });

  it('compare POSTs to /presets/compare with preset ids', () => {
    const response: PresetCompareResponse = { presets: [], rows: [] };
    service.compare(['PRESET-01', 'PRESET-04']).subscribe();
    const req = httpMock.expectOne(`${BASE}/presets/compare`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.presetIds).toEqual(['PRESET-01', 'PRESET-04']);
    req.flush(response);
  });

  it('previewApply POSTs to /presets/{id}/preview-apply', () => {
    const preview: PresetApplyPreview = {
      presetId: 'PRESET-04',
      presetName: 'Production Manufacturer',
      isCustom: false,
      deltaCount: 0,
      deltas: [],
      valid: true,
      violations: [],
    };
    service.previewApply('PRESET-04').subscribe();
    const req = httpMock.expectOne(`${BASE}/presets/PRESET-04/preview-apply`);
    expect(req.request.method).toBe('POST');
    req.flush(preview);
  });

  it('apply POSTs to /presets/{id}/apply with reason', () => {
    const result: PresetApplyResult = {
      presetId: 'PRESET-04',
      presetName: 'Production Manufacturer',
      isCustom: false,
      noOp: false,
      deltaCount: 5,
      applied: [],
    };
    service.apply('PRESET-04', 'because').subscribe();
    const req = httpMock.expectOne(`${BASE}/presets/PRESET-04/apply`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('because');
    req.flush(result);
  });

  it('previewCustom POSTs to /presets/custom/preview with overrides', () => {
    const preview: PresetCustomPreview = {
      capabilityCount: 42,
      capabilities: [],
      deltaVsCurrentInstall: [],
      valid: true,
      violations: [],
    };
    service.previewCustom([{ code: 'CAP-IDEN-AUTH-MFA', enabled: true }]).subscribe();
    const req = httpMock.expectOne(`${BASE}/presets/custom/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.capabilityOverrides).toHaveLength(1);
    req.flush(preview);
  });

  it('applyCustom POSTs to /presets/custom/apply with overrides + reason', () => {
    const result: PresetApplyResult = {
      presetId: 'PRESET-CUSTOM',
      presetName: 'Custom',
      isCustom: true,
      noOp: false,
      deltaCount: 1,
      applied: [],
    };
    service
      .applyCustom([{ code: 'CAP-IDEN-AUTH-MFA', enabled: true }], 'turn on mfa')
      .subscribe();
    const req = httpMock.expectOne(`${BASE}/presets/custom/apply`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.capabilityOverrides).toHaveLength(1);
    expect(req.request.body.reason).toBe('turn on mfa');
    req.flush(result);
  });
});
