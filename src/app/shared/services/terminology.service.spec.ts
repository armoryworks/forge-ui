import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { TerminologyService } from './terminology.service';
import { environment } from '../../../environments/environment';

describe('TerminologyService', () => {
  let service: TerminologyService;
  let httpMock: HttpTestingController;
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TerminologyService);
    httpMock = TestBed.inject(HttpTestingController);
    translate = TestBed.inject(TranslateService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('should have an empty labels map', () => {
      expect(service.labels().size).toBe(0);
    });
  });

  describe('load', () => {
    it('should fetch terminology entries from API', () => {
      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/terminology`);
      expect(req.request.method).toBe('GET');
      req.flush([
        { key: 'entity_job', label: 'Work Order' },
        { key: 'status_in_production', label: 'Manufacturing' },
      ]);

      expect(service.labels().size).toBe(2);
      expect(service.labels().get('entity_job')).toBe('Work Order');
    });

    it('should not make a second request if already loaded', () => {
      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/terminology`);
      req.flush([]);

      service.load(); // second call — should be a no-op

      httpMock.expectNone(`${environment.apiUrl}/terminology`);
    });

    it('should handle API errors gracefully', () => {
      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/terminology`);
      req.error(new ProgressEvent('error'));

      // Should not throw, labels map stays empty
      expect(service.labels().size).toBe(0);
    });
  });

  describe('resolve', () => {
    it('should return the configured label when present', () => {
      service.load();
      httpMock.expectOne(`${environment.apiUrl}/terminology`).flush([
        { key: 'entity_job', label: 'Work Order' },
      ]);

      expect(service.resolve('entity_job')).toBe('Work Order');
    });

    it('should fallback to humanized key when not found', () => {
      expect(service.resolve('entity_job')).toBe('Job');
    });

    it('should strip entity_ prefix in fallback', () => {
      expect(service.resolve('entity_purchase_order')).toBe('Purchase Order');
    });

    it('should strip status_ prefix in fallback', () => {
      expect(service.resolve('status_in_production')).toBe('In Production');
    });

    it('should strip action_ prefix in fallback', () => {
      expect(service.resolve('action_archive')).toBe('Archive');
    });

    it('should strip label_ prefix in fallback', () => {
      expect(service.resolve('label_due_date')).toBe('Due Date');
    });

    it('should title-case multi-word fallbacks', () => {
      expect(service.resolve('entity_sales_order')).toBe('Sales Order');
    });

    // Wave 13 — ngx-translate fallback tier (Pro Services rollout).
    describe('ngx-translate fallback', () => {
      it('falls through to ngx-translate when no preset override is set', () => {
        translate.setTranslation('en', { 'entity_job': 'Trabajo' });
        translate.use('en');

        // No preset override loaded, but translate has the key.
        expect(service.resolve('entity_job')).toBe('Trabajo');
      });

      it('preset overrides win over ngx-translate', () => {
        translate.setTranslation('en', { 'entity_job': 'Trabajo' });
        translate.use('en');

        // Preset override seeded — should win even though translate has a value.
        service.set('entity_job', 'Task');
        expect(service.resolve('entity_job')).toBe('Task');
      });

      it('falls through to humanize when ngx-translate returns the key verbatim', () => {
        // No translation registered for this key — ngx-translate returns the
        // key as-is, signaling "not translated"; service should humanize.
        expect(service.resolve('entity_purchase_order')).toBe('Purchase Order');
      });
    });
  });

  describe('set', () => {
    it('should update a single label for live preview', () => {
      service.set('entity_job', 'Project');

      expect(service.resolve('entity_job')).toBe('Project');
    });

    it('should override existing labels', () => {
      service.load();
      httpMock.expectOne(`${environment.apiUrl}/terminology`).flush([
        { key: 'entity_job', label: 'Work Order' },
      ]);

      service.set('entity_job', 'Project');
      expect(service.resolve('entity_job')).toBe('Project');
    });

    it('should not affect other labels when setting one', () => {
      service.set('entity_job', 'Work Order');
      service.set('entity_part', 'Component');

      expect(service.resolve('entity_job')).toBe('Work Order');
      expect(service.resolve('entity_part')).toBe('Component');
    });
  });
});
