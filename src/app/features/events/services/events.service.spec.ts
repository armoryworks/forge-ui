import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EventsService } from './events.service';
import { environment } from '../../../../environments/environment';

describe('EventsService', () => {
  let service: EventsService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/events`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getEvents', () => {
    it('should GET events without filters', () => {
      service.getEvents().subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should pass from/to/eventType params', () => {
      service.getEvents('2026-01-01', '2026-01-31', 'Training').subscribe();
      const req = httpMock.expectOne(r => r.url === base);
      expect(req.request.params.get('from')).toBe('2026-01-01');
      expect(req.request.params.get('to')).toBe('2026-01-31');
      expect(req.request.params.get('eventType')).toBe('Training');
      req.flush([]);
    });
  });

  describe('getEvent', () => {
    it('should GET event by id', () => {
      service.getEvent(5).subscribe();
      const req = httpMock.expectOne(`${base}/5`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 5 });
    });
  });

  describe('createEvent', () => {
    it('should POST new event', () => {
      const request = { title: 'Safety Meeting', eventType: 'Safety' } as any;
      service.createEvent(request).subscribe();
      const req = httpMock.expectOne(base);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ id: 1 });
    });
  });

  describe('updateEvent', () => {
    it('should PUT event update', () => {
      const request = { title: 'Updated Meeting', eventType: 'Meeting' } as any;
      service.updateEvent(3, request).subscribe();
      const req = httpMock.expectOne(`${base}/3`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush({ id: 3 });
    });
  });

  describe('deleteEvent', () => {
    it('should DELETE event', () => {
      service.deleteEvent(4).subscribe();
      const req = httpMock.expectOne(`${base}/4`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('respondToEvent', () => {
    it('should POST RSVP response', () => {
      service.respondToEvent(6, 'Accepted').subscribe();
      const req = httpMock.expectOne(`${base}/6/respond`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ status: 'Accepted' });
      req.flush(null);
    });
  });

  describe('getUpcomingEvents', () => {
    it('should GET upcoming events', () => {
      service.getUpcomingEvents().subscribe();
      const req = httpMock.expectOne(`${base}/upcoming`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getUpcomingEventsForUser', () => {
    it('should GET upcoming events for specific user', () => {
      service.getUpcomingEventsForUser(12).subscribe();
      const req = httpMock.expectOne(`${base}/upcoming/12`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});
