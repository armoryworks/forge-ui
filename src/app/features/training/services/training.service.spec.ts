import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TrainingService } from './training.service';
import { environment } from '../../../../environments/environment';

describe('TrainingService', () => {
  let service: TrainingService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;
  const base = `${apiUrl}/training`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrainingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getModules', () => {
    it('should GET modules list', () => {
      service.getModules().subscribe();
      const req = httpMock.expectOne(`${base}/modules`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [], totalCount: 0 });
    });

    it('should pass filter params', () => {
      service.getModules({ contentType: 'Article', tag: 'safety' }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${base}/modules`);
      expect(req.request.params.get('contentType')).toBe('Article');
      expect(req.request.params.get('tag')).toBe('safety');
      req.flush({ data: [], totalCount: 0 });
    });
  });

  describe('getModule', () => {
    it('should GET module detail', () => {
      service.getModule(5).subscribe();
      const req = httpMock.expectOne(`${base}/modules/5`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 5, title: 'Test' });
    });
  });

  describe('getPaths', () => {
    it('should GET training paths', () => {
      service.getPaths().subscribe();
      const req = httpMock.expectOne(`${base}/paths`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getMyEnrollments', () => {
    it('should GET my enrollments', () => {
      service.getMyEnrollments().subscribe();
      const req = httpMock.expectOne(`${base}/my-enrollments`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getMyProgress', () => {
    it('should GET my progress', () => {
      service.getMyProgress().subscribe();
      const req = httpMock.expectOne(`${base}/my-progress`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('recordStart', () => {
    it('should POST start event', () => {
      service.recordStart(3).subscribe();
      const req = httpMock.expectOne(`${base}/progress/3/start`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('completeModule', () => {
    it('should POST complete event', () => {
      service.completeModule(3).subscribe();
      const req = httpMock.expectOne(`${base}/progress/3/complete`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('submitQuiz', () => {
    it('should POST quiz answers', () => {
      const answers = [{ questionId: 'q1', answer: 'A' }] as any;
      service.submitQuiz(3, answers).subscribe();
      const req = httpMock.expectOne(`${base}/progress/3/submit-quiz`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.answers).toEqual(answers);
      req.flush({ passed: true, score: 100 });
    });
  });

  describe('createModule', () => {
    it('should POST new module', () => {
      const data = { title: 'New Module' } as any;
      service.createModule(data).subscribe();
      const req = httpMock.expectOne(`${base}/modules`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 1 });
    });
  });

  describe('deleteModule', () => {
    it('should DELETE module', () => {
      service.deleteModule(7).subscribe();
      const req = httpMock.expectOne(`${base}/modules/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getUserTrainingDetail', () => {
    it('should GET user training detail', () => {
      service.getUserTrainingDetail(4).subscribe();
      const req = httpMock.expectOne(`${base}/admin/users/4/detail`);
      expect(req.request.method).toBe('GET');
      req.flush({ userId: 4 });
    });
  });
});
