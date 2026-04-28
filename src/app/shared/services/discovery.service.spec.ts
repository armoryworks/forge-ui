import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { DiscoveryService } from './discovery.service';
import {
  DiscoveryQuestion,
  DiscoveryQuestionsResponse,
} from '../models/discovery-question.model';
import { DiscoveryRecommendation } from '../models/discovery-recommendation.model';

const BASE = environment.apiUrl;

const sampleCatalog: DiscoveryQuestionsResponse = {
  totalCount: 27,
  selfServeCount: 27,
  consultantDeepdiveCount: 12,
  questions: [
    {
      id: 'Q-O1',
      stage: 'Opening',
      category: 'Opening',
      type: 'Bucketed',
      text: 'Headcount?',
      whyAsking: 'Headcount drives complexity',
      choices: [
        { value: '1-2', label: '1-2' },
        { value: '11-25', label: '11-25' },
        { value: '51-200', label: '51-200' },
      ],
      branch: null,
    },
    {
      id: 'Q-O3',
      stage: 'Opening',
      category: 'Opening',
      type: 'SingleChoice',
      text: 'Make / resell / both?',
      whyAsking: 'Mode',
      choices: [
        { value: 'make', label: 'Make' },
        { value: 'resell', label: 'Resell' },
        { value: 'both', label: 'Both' },
      ],
      branch: null,
    },
    {
      id: 'Q-O5',
      stage: 'Opening',
      category: 'Opening',
      type: 'SingleChoice',
      text: 'Sites?',
      whyAsking: 'Sites',
      choices: [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
      ],
      branch: null,
    },
    {
      id: 'Q-A1',
      stage: 'BranchA',
      category: 'BranchSpecific',
      type: 'SingleChoice',
      text: 'Accounting?',
      whyAsking: 'Accounting mutex',
      choices: [{ value: 'none', label: 'None' }],
      branch: 'A',
    },
    {
      id: 'Q-B1',
      stage: 'BranchB',
      category: 'BranchSpecific',
      type: 'SingleChoice',
      text: 'Variance?',
      whyAsking: 'Variance review',
      choices: [{ value: 'no', label: 'No' }],
      branch: 'B',
    },
    {
      id: 'Q-C1',
      stage: 'BranchC',
      category: 'BranchSpecific',
      type: 'SingleChoice',
      text: 'Inter-site transfers?',
      whyAsking: 'Multi-site signal',
      choices: [{ value: 'weekly', label: 'Weekly' }],
      branch: 'C',
    },
    {
      id: 'Q-D1',
      stage: 'Diagnostic',
      category: 'Diagnostic',
      type: 'SingleChoice',
      text: 'Lots / serials?',
      whyAsking: 'Trace',
      choices: [{ value: 'lots', label: 'Lots' }],
      branch: null,
    },
    {
      id: 'Q-V1',
      stage: 'Override',
      category: 'Override',
      type: 'FreeText',
      text: 'Worst case audit?',
      whyAsking: 'Override probe',
      choices: null,
      branch: null,
    },
    {
      id: 'Q-A5',
      stage: 'BranchA',
      category: 'ConsultantDeepdive',
      type: 'YesNo',
      text: 'Consultant Q-A5',
      whyAsking: 'Deepdive',
      choices: null,
      branch: 'A',
    },
  ] satisfies DiscoveryQuestion[],
};

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DiscoveryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('routes to Branch A for small headcount + single site', () => {
    service.loadQuestions(false).subscribe();
    httpMock.expectOne(`${BASE}/discovery/questions`).flush(sampleCatalog);

    service.setAnswer('Q-O1', '1-2');
    service.setAnswer('Q-O3', 'make');
    service.setAnswer('Q-O5', '1');

    expect(service.headcountBucket()).toBe('small');
    expect(service.mode()).toBe('production');
    expect(service.sitesBucket()).toBe('single');
    expect(service.branch()).toBe('A');
  });

  it('routes to Branch C when multi-site even at mid headcount (4C decision #4 / #10)', () => {
    service.loadQuestions(false).subscribe();
    httpMock.expectOne(`${BASE}/discovery/questions`).flush(sampleCatalog);

    service.setAnswer('Q-O1', '51-200');
    service.setAnswer('Q-O3', 'make');
    service.setAnswer('Q-O5', '2');

    expect(service.branch()).toBe('C');
  });

  it('routes to Branch B for mid headcount single-site', () => {
    service.loadQuestions(false).subscribe();
    httpMock.expectOne(`${BASE}/discovery/questions`).flush(sampleCatalog);

    service.setAnswer('Q-O1', '51-200');
    service.setAnswer('Q-O3', 'make');
    service.setAnswer('Q-O5', '1');

    expect(service.branch()).toBe('B');
  });

  it('filters visible questions to only the current branch', () => {
    service.loadQuestions(false).subscribe();
    httpMock.expectOne(`${BASE}/discovery/questions`).flush(sampleCatalog);

    service.setAnswer('Q-O1', '1-2');
    service.setAnswer('Q-O3', 'make');
    service.setAnswer('Q-O5', '1');

    const visible = service.visibleQuestions();
    expect(visible.find((q) => q.id === 'Q-A1')).toBeTruthy();
    expect(visible.find((q) => q.id === 'Q-B1')).toBeFalsy();
    expect(visible.find((q) => q.id === 'Q-C1')).toBeFalsy();
  });

  it('hides consultant deepdive questions in self-serve mode', () => {
    service.loadQuestions(false).subscribe();
    httpMock.expectOne(`${BASE}/discovery/questions`).flush(sampleCatalog);

    service.setAnswer('Q-O1', '1-2');
    service.setAnswer('Q-O3', 'make');
    service.setAnswer('Q-O5', '1');

    const visible = service.visibleQuestions();
    expect(visible.find((q) => q.id === 'Q-A5')).toBeFalsy();
  });

  it('preview() calls /discovery/preview and stores recommendation', () => {
    service.loadQuestions(false).subscribe();
    httpMock.expectOne(`${BASE}/discovery/questions`).flush(sampleCatalog);

    service.setAnswer('Q-O1', '1-2');
    service.setAnswer('Q-O3', 'make');

    service.preview().subscribe();
    const previewReq = httpMock.expectOne(`${BASE}/discovery/preview`);
    expect(previewReq.request.method).toBe('POST');
    const sample: DiscoveryRecommendation = {
      presetId: 'PRESET-01',
      presetName: 'Two-Person Shop',
      presetDescription: 'desc',
      confidence: 1,
      confidenceLabel: 'high',
      rationale: 'r',
      factors: [],
      alternatives: [],
      capabilityDeltas: [],
    };
    previewReq.flush(sample);
    expect(service.recommendation()?.presetId).toBe('PRESET-01');
  });

  it('apply() POSTs to /discovery/apply with chosen preset and answers', () => {
    service.loadQuestions(false).subscribe();
    httpMock.expectOne(`${BASE}/discovery/questions`).flush(sampleCatalog);

    service.setAnswer('Q-O1', '1-2');
    service.setAnswer('Q-O3', 'make');

    service.apply('PRESET-01').subscribe();
    const applyReq = httpMock.expectOne(`${BASE}/discovery/apply`);
    expect(applyReq.request.method).toBe('POST');
    expect(applyReq.request.body.chosenPresetId).toBe('PRESET-01');
    expect(applyReq.request.body.answers.length).toBe(2);
    applyReq.flush({
      presetId: 'PRESET-01',
      presetName: 'Two-Person Shop',
      presetDescription: '',
      confidence: 1,
      confidenceLabel: 'high',
      rationale: '',
      factors: [],
      alternatives: [],
      capabilityDeltas: [],
    });
  });
});
