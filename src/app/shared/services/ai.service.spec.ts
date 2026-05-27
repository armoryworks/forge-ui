import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import {
  AiService,
  AiGenerateResponse,
  AiSummarizeResponse,
  AiAvailabilityResponse,
  AiSearchSuggestion,
  AiHelpResponse,
} from './ai.service';
import { CapabilityService } from './capability.service';
import { RagSearchResponse } from '../models/rag-search-response.model';
import { environment } from '../../../environments/environment';

describe('AiService', () => {
  let service: AiService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/ai`;

  const mockRagSearchResponse: RagSearchResponse = {
    results: [
      {
        entityType: 'job',
        entityId: 42,
        chunkText: 'Widget assembly process requires 4 steel brackets',
        sourceField: 'description',
        score: 0.92,
      },
    ],
    generatedAnswer: 'The widget assembly requires 4 steel brackets.',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AiService);
    httpMock = TestBed.inject(HttpTestingController);

    // checkAvailability() now loads the capability descriptor first when it isn't
    // loaded yet (wave-0 header-init race fix, via the deduped CapabilityService.load).
    // Stub that load to resolve synchronously with no HTTP so the descriptor step is
    // transparent and these checkAvailability assertions exercise the gate logic directly.
    vi.spyOn(TestBed.inject(CapabilityService), 'load').mockReturnValue(of(void 0));
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('should have available as false initially', () => {
      expect(service.available()).toBe(false);
    });

    it('should have checking as false initially', () => {
      expect(service.checking()).toBe(false);
    });
  });

  describe('checkAvailability', () => {
    it('should GET the status endpoint and set available to true on success', () => {
      service.checkAvailability();

      expect(service.checking()).toBe(true);

      const req = httpMock.expectOne(`${baseUrl}/status`);
      expect(req.request.method).toBe('GET');
      req.flush({ available: true } satisfies AiAvailabilityResponse);

      expect(service.available()).toBe(true);
      expect(service.checking()).toBe(false);
    });

    it('should set available to false when AI is not available', () => {
      service.checkAvailability();

      const req = httpMock.expectOne(`${baseUrl}/status`);
      req.flush({ available: false } satisfies AiAvailabilityResponse);

      expect(service.available()).toBe(false);
      expect(service.checking()).toBe(false);
    });

    it('should set available to false and checking to false when the request errors', () => {
      service.checkAvailability();

      const req = httpMock.expectOne(`${baseUrl}/status`);
      req.error(new ProgressEvent('error'));

      expect(service.available()).toBe(false);
      expect(service.checking()).toBe(false);
    });

    it('should expose capabilityDisabled signal initialized to false (Phase 4 Phase-D)', () => {
      expect(service.capabilityDisabled()).toBe(false);
    });

    it('should keep capabilityDisabled false on success (Phase 4 Phase-D)', () => {
      service.checkAvailability();

      const req = httpMock.expectOne(`${baseUrl}/status`);
      req.flush({ available: true } satisfies AiAvailabilityResponse);

      expect(service.capabilityDisabled()).toBe(false);
    });
  });

  describe('layer-3 descriptor pre-check (Phase 4 Phase-D)', () => {
    it('does NOT fire the HTTP request when CAP-EXT-AI-ASSISTANT is known-disabled', () => {
      const capability = TestBed.inject(CapabilityService);
      const isKnownSpy = vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      const isEnabledSpy = vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      service.checkAvailability();

      // Critical: no HTTP traffic at all
      httpMock.expectNone(`${baseUrl}/status`);
      expect(service.capabilityDisabled()).toBe(true);
      expect(service.available()).toBe(false);
      expect(service.checking()).toBe(false);

      isKnownSpy.mockRestore();
      isEnabledSpy.mockRestore();
    });

    it('fires the HTTP request normally when CAP-EXT-AI-ASSISTANT is known-enabled', () => {
      const capability = TestBed.inject(CapabilityService);
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(true);

      service.checkAvailability();

      const req = httpMock.expectOne(`${baseUrl}/status`);
      req.flush({ available: true } satisfies AiAvailabilityResponse);

      expect(service.capabilityDisabled()).toBe(false);
      expect(service.available()).toBe(true);
    });

    it('fires the HTTP request when capability is unknown (descriptor not loaded yet)', () => {
      const capability = TestBed.inject(CapabilityService);
      vi.spyOn(capability, 'isKnown').mockReturnValue(false);

      service.checkAvailability();

      const req = httpMock.expectOne(`${baseUrl}/status`);
      req.flush({ available: false } satisfies AiAvailabilityResponse);

      expect(service.capabilityDisabled()).toBe(false);
    });
  });

  describe('generate', () => {
    it('should POST the prompt and return the generated text', () => {
      let result: AiGenerateResponse | null = null;
      service.generate('Summarize this job').subscribe((res) => { result = res; });

      const req = httpMock.expectOne(`${baseUrl}/generate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ prompt: 'Summarize this job' });
      req.flush({ text: 'This job involves...' } satisfies AiGenerateResponse);

      expect(result).not.toBeNull();
      expect(result!.text).toBe('This job involves...');
    });
  });

  describe('summarize', () => {
    it('should POST the text and return the summary', () => {
      let result: AiSummarizeResponse | null = null;
      service.summarize('Long text to summarize').subscribe((res) => { result = res; });

      const req = httpMock.expectOne(`${baseUrl}/summarize`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ text: 'Long text to summarize' });
      req.flush({ summary: 'Short summary here' } satisfies AiSummarizeResponse);

      expect(result).not.toBeNull();
      expect(result!.summary).toBe('Short summary here');
    });
  });

  describe('searchSuggest', () => {
    it('should POST the query and return search suggestions', () => {
      const mockSuggestions: AiSearchSuggestion[] = [
        {
          label: 'Job JOB-042',
          description: 'Widget Build',
          url: '/kanban?job=42',
          icon: 'work',
        },
      ];
      let result: AiSearchSuggestion[] = [];

      service.searchSuggest('widget').subscribe((res) => { result = res; });

      const req = httpMock.expectOne(`${baseUrl}/search-suggest`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ query: 'widget' });
      req.flush(mockSuggestions);

      expect(result.length).toBe(1);
      expect(result[0].label).toBe('Job JOB-042');
    });
  });

  describe('helpChat', () => {
    it('should POST question without history and return the answer', () => {
      let result: AiHelpResponse | null = null;
      service.helpChat('How do I create a job?').subscribe((res) => { result = res; });

      const req = httpMock.expectOne(`${baseUrl}/help`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ question: 'How do I create a job?', history: undefined });
      req.flush({ answer: 'Go to the kanban board...' } satisfies AiHelpResponse);

      expect(result!.answer).toBe('Go to the kanban board...');
    });

    it('should include conversation history in the POST body', () => {
      const history = [{ role: 'user' as const, content: 'Prior question' }];
      service.helpChat('Follow-up question', history).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/help`);
      expect(req.request.body.history).toEqual(history);
      req.flush({ answer: 'Follow-up answer' });
    });
  });

  describe('ragSearch', () => {
    it('should POST a search query and return RAG results', () => {
      let result: RagSearchResponse | null = null;

      service.ragSearch('steel bracket').subscribe((res) => { result = res; });

      const req = httpMock.expectOne(`${baseUrl}/search`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        query: 'steel bracket',
        entityTypeFilter: undefined,
        includeAnswer: false,
      });
      req.flush(mockRagSearchResponse);

      expect(result).not.toBeNull();
      expect(result!.results.length).toBe(1);
      expect(result!.results[0].entityType).toBe('job');
      expect(result!.generatedAnswer).toBe('The widget assembly requires 4 steel brackets.');
    });

    it('should include entityTypeFilter when provided', () => {
      service.ragSearch('bracket', 'part').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/search`);
      expect(req.request.body.entityTypeFilter).toBe('part');
      req.flush({ results: [], generatedAnswer: null });
    });

    it('should set includeAnswer to true when specified', () => {
      service.ragSearch('bracket', undefined, true).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/search`);
      expect(req.request.body.includeAnswer).toBe(true);
      req.flush(mockRagSearchResponse);
    });

    it('should return an empty results array when no matches are found', () => {
      let result: RagSearchResponse | null = null;
      service.ragSearch('xyzzy').subscribe((res) => { result = res; });

      const req = httpMock.expectOne(`${baseUrl}/search`);
      req.flush({ results: [], generatedAnswer: null });

      expect(result!.results).toEqual([]);
      expect(result!.generatedAnswer).toBeNull();
    });
  });

  describe('indexDocument', () => {
    it('should POST entity type and id and return the chunk count', () => {
      let result: number | null = null;

      service.indexDocument('job', 42).subscribe((count) => { result = count; });

      const req = httpMock.expectOne(`${baseUrl}/index`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ entityType: 'job', entityId: 42 });
      req.flush(7);

      expect(result).toBe(7);
    });

    it('should return 0 when no chunks were indexed', () => {
      let result: number | null = null;
      service.indexDocument('part', 99).subscribe((count) => { result = count; });

      const req = httpMock.expectOne(`${baseUrl}/index`);
      req.flush(0);

      expect(result).toBe(0);
    });
  });

  describe('ragHelpChat', () => {
    it('should POST message and return plain text response', () => {
      let result: string | null = null;

      service.ragHelpChat('What are the open jobs?').subscribe((res) => { result = res; });

      const req = httpMock.expectOne(`${baseUrl}/help`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        message: 'What are the open jobs?',
        conversationHistory: undefined,
      });
      req.flush('There are 5 open jobs.');

      expect(result).toBe('There are 5 open jobs.');
    });

    it('should include conversation history when provided', () => {
      const history = ['Previous message'];
      service.ragHelpChat('Follow-up', history).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/help`);
      expect(req.request.body.conversationHistory).toEqual(history);
      req.flush('Answer to follow-up');
    });
  });
});
