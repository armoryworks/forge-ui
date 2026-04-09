import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ChatService } from './chat.service';
import { environment } from '../../../../environments/environment';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getConversations', () => {
    it('should GET conversations list', () => {
      service.getConversations().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/chat/conversations`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getMessages', () => {
    it('should GET messages with pagination', () => {
      service.getMessages(5, 2, 25).subscribe();
      const req = httpMock.expectOne(r => r.url === `${apiUrl}/chat/conversations/5/messages`);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('25');
      req.flush([]);
    });
  });

  describe('sendMessage', () => {
    it('should POST message to recipient', () => {
      service.sendMessage(3, 'Hello').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/chat/conversations/3/messages`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.content).toBe('Hello');
      req.flush({ id: 1 });
    });
  });

  describe('markAsRead', () => {
    it('should POST mark-as-read', () => {
      service.markAsRead(4).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/chat/conversations/4/read`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('getChatRooms', () => {
    it('should GET chat rooms', () => {
      service.getChatRooms().subscribe();
      const req = httpMock.expectOne(`${apiUrl}/chat/rooms`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createChatRoom', () => {
    it('should POST new room', () => {
      service.createChatRoom('Team Chat', [1, 2, 3]).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/chat/rooms`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.name).toBe('Team Chat');
      expect(req.request.body.memberIds).toEqual([1, 2, 3]);
      req.flush({ id: 1 });
    });
  });

  describe('sendChatRoomMessage', () => {
    it('should POST message to room', () => {
      service.sendChatRoomMessage(2, 'Room message').subscribe();
      const req = httpMock.expectOne(`${apiUrl}/chat/rooms/2/messages`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.content).toBe('Room message');
      req.flush({ id: 1 });
    });
  });

  describe('addRoomMember', () => {
    it('should POST add member', () => {
      service.addRoomMember(2, 5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/chat/rooms/2/members`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.userId).toBe(5);
      req.flush(null);
    });
  });

  describe('removeRoomMember', () => {
    it('should DELETE room member', () => {
      service.removeRoomMember(2, 5).subscribe();
      const req = httpMock.expectOne(`${apiUrl}/chat/rooms/2/members/5`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
