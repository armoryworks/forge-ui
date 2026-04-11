import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ComplianceFormService } from './compliance-form.service';
import { environment } from '../../../../environments/environment';

describe('ComplianceFormService', () => {
  let service: ComplianceFormService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/compliance-forms`;
  const identityBase = `${environment.apiUrl}/identity-documents`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ComplianceFormService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('loadTemplates', () => {
    it('should GET templates and update signal', () => {
      const mockTemplates = [{ id: 1, name: 'W-4', formType: 'W4' }];
      service.loadTemplates();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      req.flush(mockTemplates);
      expect(service.templates()).toEqual(mockTemplates as any);
    });
  });

  describe('loadMySubmissions', () => {
    it('should GET submissions and update signal', () => {
      const mockSubmissions = [{ id: 1, status: 'Completed' }];
      service.loadMySubmissions();
      const req = httpMock.expectOne(`${base}/submissions/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSubmissions);
      expect(service.submissions()).toEqual(mockSubmissions as any);
    });
  });

  describe('getSubmissionByType', () => {
    it('should GET submission by form type', () => {
      service.getSubmissionByType('W4').subscribe();
      const req = httpMock.expectOne(`${base}/submissions/me/W4`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 1 });
    });
  });

  describe('createSubmission', () => {
    it('should POST to create submission and reload submissions', () => {
      service.createSubmission(5).subscribe();
      const req = httpMock.expectOne(`${base}/5/submit`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 10 });
      // createSubmission triggers loadMySubmissions via tap
      const reload = httpMock.expectOne(`${base}/submissions/me`);
      reload.flush([]);
    });
  });

  describe('saveFormData', () => {
    it('should PUT form data and reload submissions', () => {
      const formDataJson = '{"field":"value"}';
      service.saveFormData(3, formDataJson, 7).subscribe();
      const req = httpMock.expectOne(`${base}/3/form-data`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ formDataJson, formDefinitionVersionId: 7 });
      req.flush({ id: 3 });
      const reload = httpMock.expectOne(`${base}/submissions/me`);
      reload.flush([]);
    });

    it('should send null formDefinitionVersionId when not provided', () => {
      service.saveFormData(3, '{}').subscribe();
      const req = httpMock.expectOne(`${base}/3/form-data`);
      expect(req.request.body.formDefinitionVersionId).toBeUndefined();
      req.flush({ id: 3 });
      httpMock.expectOne(`${base}/submissions/me`).flush([]);
    });
  });

  describe('submitFormData', () => {
    it('should POST form submission and reload submissions', () => {
      const formDataJson = '{"completed":true}';
      service.submitFormData(4, formDataJson, 2).subscribe();
      const req = httpMock.expectOne(`${base}/4/submit-form`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ formDataJson, formDefinitionVersionId: 2 });
      req.flush({ id: 4 });
      const reload = httpMock.expectOne(`${base}/submissions/me`);
      reload.flush([]);
    });
  });

  describe('getMyStateDefinition', () => {
    it('should GET state definition', () => {
      service.getMyStateDefinition().subscribe();
      const req = httpMock.expectOne(`${base}/my-state-definition`);
      expect(req.request.method).toBe('GET');
      req.flush({ stateCode: 'OH' });
    });
  });

  describe('loadMyIdentityDocuments', () => {
    it('should GET identity documents and update signal', () => {
      const mockDocs = [{ id: 1, documentType: 'Passport' }];
      service.loadMyIdentityDocuments();
      const req = httpMock.expectOne(`${identityBase}/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDocs);
      expect(service.identityDocuments()).toEqual(mockDocs as any);
    });
  });

  describe('uploadIdentityDocument', () => {
    it('should POST identity document and reload documents', () => {
      service.uploadIdentityDocument('Passport', '2030-01-01T00:00:00Z', 42).subscribe();
      const req = httpMock.expectOne(`${identityBase}/me?fileAttachmentId=42`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ documentType: 'Passport', expiresAt: '2030-01-01T00:00:00Z' });
      req.flush({ id: 1 });
      const reload = httpMock.expectOne(`${identityBase}/me`);
      reload.flush([]);
    });
  });

  describe('deleteIdentityDocument', () => {
    it('should DELETE identity document and reload documents', () => {
      service.deleteIdentityDocument(5).subscribe();
      const req = httpMock.expectOne(`${identityBase}/me/5`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      const reload = httpMock.expectOne(`${identityBase}/me`);
      reload.flush([]);
    });
  });

  describe('downloadSubmissionPdf', () => {
    it('should GET submission PDF as blob', () => {
      service.downloadSubmissionPdf(10).subscribe();
      const req = httpMock.expectOne(`${base}/submissions/10/pdf`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob());
    });
  });
});
