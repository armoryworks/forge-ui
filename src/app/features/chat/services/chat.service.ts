import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ChatConversation } from '../models/chat-conversation.model';
import { ChatMessage } from '../models/chat-message.model';
import { ChatRoom } from '../models/chat-room.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/chat`;

  getConversations(): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>(`${this.baseUrl}/conversations`);
  }

  getMessages(otherUserId: number, page = 1, pageSize = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${otherUserId}`, {
      params: { page: page.toString(), pageSize: pageSize.toString() },
    });
  }

  sendMessage(recipientId: number, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/messages`, { recipientId, content });
  }

  markAsRead(otherUserId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/messages/${otherUserId}/read`, {});
  }

  // Group Chat Rooms
  getChatRooms(): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(`${this.baseUrl}/rooms`);
  }

  createChatRoom(name: string, memberIds: number[]): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(`${this.baseUrl}/rooms`, { name, memberIds });
  }

  getChatRoomMessages(roomId: number, page = 1, pageSize = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/rooms/${roomId}/messages`, {
      params: { page: page.toString(), pageSize: pageSize.toString() },
    });
  }

  sendChatRoomMessage(roomId: number, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/rooms/${roomId}/messages`, { content, recipientId: 0 });
  }

  addRoomMember(roomId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rooms/${roomId}/members/${userId}`, {});
  }

  removeRoomMember(roomId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/rooms/${roomId}/members/${userId}`);
  }
}
