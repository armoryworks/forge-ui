import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { TrainingService } from './training.service';
import { AuthService, AuthUser } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { environment } from '../../../../environments/environment';

const PENDING_KEY = 'training:pending-completions';

describe('TrainingService', () => {
  let service: TrainingService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;
  const base = `${apiUrl}/training`;
  const user = signal<AuthUser | null>(null);
  const snackbar = { info: vi.fn() };

  const asUser = (id: number) => ({ id, roles: [] } as unknown as AuthUser);

  beforeEach(() => {
    localStorage.removeItem(PENDING_KEY);
    user.set(null);
    snackbar.info.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService(),
        { provide: AuthService, useValue: { user } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    service = TestBed.inject(TrainingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(PENDING_KEY);
  });

  describe('completeOrQueue', () => {
    it('queues an offline completion for the user who earned it', () => {
      user.set(asUser(7));
      let outcome: string | undefined;
      service.completeOrQueue(3).subscribe(o => outcome = o);
      httpMock.expectOne(`${base}/progress/3/complete`).flush(null, { status: 0, statusText: 'Unknown Error' });

      expect(outcome).toBe('queued');
      expect(JSON.parse(localStorage.getItem(PENDING_KEY)!)).toEqual([{ userId: 7, moduleId: 3 }]);
      expect(snackbar.info).toHaveBeenCalled();
    });

    it('does not queue a refused completion', () => {
      user.set(asUser(7));
      let failed = false;
      service.completeOrQueue(3).subscribe({ error: () => failed = true });
      httpMock.expectOne(`${base}/progress/3/complete`).flush({}, { status: 409, statusText: 'Conflict' });

      expect(failed).toBe(true);
      expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    });

    it('queues a walkthrough whose session ended mid-tour under the user who started it, and replays it only for them', () => {
      let outcome: string | undefined;
      service.completeOrQueue(3, 7).subscribe(o => outcome = o);

      httpMock.expectNone(`${base}/progress/3/complete`);
      expect(outcome).toBe('queued');
      expect(JSON.parse(localStorage.getItem(PENDING_KEY)!)).toEqual([{ userId: 7, moduleId: 3 }]);

      user.set(asUser(8));
      TestBed.tick();
      httpMock.expectNone(`${base}/progress/3/complete`);

      user.set(asUser(7));
      TestBed.tick();
      httpMock.expectOne(`${base}/progress/3/complete`).flush(null);
      expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    });

    it('does not credit a walkthrough to a different user who signed in mid-tour', () => {
      user.set(asUser(8));
      TestBed.tick();
      service.completeOrQueue(3, 7).subscribe();

      httpMock.expectNone(`${base}/progress/3/complete`);
      expect(JSON.parse(localStorage.getItem(PENDING_KEY)!)).toEqual([{ userId: 7, moduleId: 3 }]);
    });

    it('fails without queueing when nobody can be credited', () => {
      let failed = false;
      service.completeOrQueue(3).subscribe({ error: () => failed = true });

      httpMock.expectNone(`${base}/progress/3/complete`);
      expect(failed).toBe(true);
      expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    });

    it('replays only the signed-in user\'s queued completions', () => {
      localStorage.setItem(PENDING_KEY, JSON.stringify([{ userId: 7, moduleId: 3 }, { userId: 8, moduleId: 4 }, 5]));
      user.set(asUser(8));
      TestBed.tick();

      httpMock.expectOne(`${base}/progress/4/complete`).flush(null);
      httpMock.expectNone(`${base}/progress/3/complete`);
      httpMock.expectNone(`${base}/progress/5/complete`);
      expect(JSON.parse(localStorage.getItem(PENDING_KEY)!)).toEqual([{ userId: 7, moduleId: 3 }]);
    });

    it('drops a replayed completion the server refuses, keeps one that is still offline', () => {
      localStorage.setItem(PENDING_KEY, JSON.stringify([{ userId: 8, moduleId: 4 }, { userId: 8, moduleId: 5 }]));
      user.set(asUser(8));
      TestBed.tick();

      httpMock.expectOne(`${base}/progress/4/complete`).flush({}, { status: 404, statusText: 'Not Found' });
      httpMock.expectOne(`${base}/progress/5/complete`).flush(null, { status: 0, statusText: 'Unknown Error' });
      expect(JSON.parse(localStorage.getItem(PENDING_KEY)!)).toEqual([{ userId: 8, moduleId: 5 }]);
    });

    it('does not resend a queued completion that is still in flight when the user signal re-emits', () => {
      localStorage.setItem(PENDING_KEY, JSON.stringify([{ userId: 8, moduleId: 4 }]));
      user.set(asUser(8));
      TestBed.tick();
      const first = httpMock.expectOne(`${base}/progress/4/complete`);

      user.set(asUser(8));
      TestBed.tick();
      httpMock.expectNone(`${base}/progress/4/complete`);

      first.flush(null);
      expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    });
  });

  describe('getAllModules', () => {
    it('follows every page at the server cap', () => {
      let titles: string[] = [];
      service.getAllModules().subscribe(all => titles = all.map(m => m.title));

      const first = httpMock.expectOne(r => r.url === `${base}/modules` && r.params.get('page') === '1');
      expect(first.request.params.get('pageSize')).toBe('100');
      first.flush({ data: [{ title: 'a' }], page: 1, pageSize: 100, totalCount: 101, totalPages: 2 });
      httpMock.expectOne(r => r.url === `${base}/modules` && r.params.get('page') === '2')
        .flush({ data: [{ title: 'b' }], page: 2, pageSize: 100, totalCount: 101, totalPages: 2 });

      expect(titles).toEqual(['a', 'b']);
    });
  });

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
