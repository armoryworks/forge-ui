import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EntityActivityService } from './entity-activity.service';
import { environment } from '../../../environments/environment';

describe('EntityActivityService', () => {
  let service: EntityActivityService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EntityActivityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getActivity', () => {
    it('should GET activity for an entity', () => {
      service.getActivity('jobs', 10).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/jobs/10/activity`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getHistory', () => {
    it('should GET history for an entity', () => {
      service.getHistory('parts', 5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/parts/5/history`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getNotes', () => {
    it('should GET notes for an entity', () => {
      service.getNotes('jobs', 10).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/jobs/10/notes`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createNote', () => {
    it('should POST a new note', () => {
      service.createNote('jobs', 10, 'Test note', [1, 2]).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/jobs/10/notes`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ text: 'Test note', mentionedUserIds: [1, 2] });
      req.flush({ id: 1, text: 'Test note', authorName: 'A', authorInitials: 'A', authorColor: '#000', createdAt: '2026-01-01T00:00:00Z', updatedAt: null });
    });

    it('should POST a note with empty mentions by default', () => {
      service.createNote('jobs', 10, 'No mentions').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/jobs/10/notes`);
      expect(req.request.body).toEqual({ text: 'No mentions', mentionedUserIds: [] });
      req.flush({ id: 2, text: 'No mentions', authorName: 'A', authorInitials: 'A', authorColor: '#000', createdAt: '2026-01-01T00:00:00Z', updatedAt: null });
    });
  });

  describe('deleteNote', () => {
    it('should DELETE a note', () => {
      service.deleteNote('jobs', 10, 3).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/jobs/10/notes/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('postComment', () => {
    it('should POST a comment', () => {
      service.postComment('parts', 5, 'Great work', [3]).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/parts/5/comments`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ comment: 'Great work', mentionedUserIds: [3] });
      req.flush({ id: 1, action: 'comment', fieldName: null, oldValue: null, newValue: null, description: 'Great work', userInitials: 'A', userName: 'Admin', createdAt: '2026-01-01T00:00:00Z' });
    });
  });

  describe('getMentionUsers', () => {
    it('should GET mention users list', () => {
      service.getMentionUsers().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/users`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});
