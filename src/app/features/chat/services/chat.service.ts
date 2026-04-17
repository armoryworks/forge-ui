import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ChatConversation } from '../models/chat-conversation.model';
import { ChatMessage, ChatFileAttachment } from '../models/chat-message.model';
import { ChatRoom, CreateChannelRequest, UpdateChannelRequest } from '../models/chat-room.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/chat`;

  // ── Direct Messages ──

  getConversations(): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>(`${this.baseUrl}/conversations`);
  }

  getMessages(otherUserId: number, page = 1, pageSize = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${otherUserId}`, {
      params: { page: page.toString(), pageSize: pageSize.toString() },
    });
  }

  sendMessage(recipientId: number, content: string, fileAttachmentId?: number, linkedEntityType?: string, linkedEntityId?: number): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/messages`, { recipientId, content, fileAttachmentId, linkedEntityType, linkedEntityId });
  }

  markAsRead(otherUserId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/messages/${otherUserId}/read`, {});
  }

  // ── Threads ──

  getThread(messageId: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${messageId}/thread`);
  }

  replyInThread(messageId: number, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/messages/${messageId}/reply`, { content });
  }

  // ── Channels ──

  getChannels(): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(`${this.baseUrl}/channels`);
  }

  createChannel(request: CreateChannelRequest): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(`${this.baseUrl}/channels`, request);
  }

  updateChannel(channelId: number, request: UpdateChannelRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/channels/${channelId}`, request);
  }

  joinChannel(channelId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/channels/${channelId}/join`, {});
  }

  leaveChannel(channelId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/channels/${channelId}/leave`, {});
  }

  muteChannel(channelId: number, mute: boolean): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/channels/${channelId}/mute`, {}, {
      params: { mute: mute.toString() },
    });
  }

  markChannelRead(channelId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/channels/${channelId}/read`, {});
  }

  discoverChannels(search?: string): Observable<ChatRoom[]> {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    return this.http.get<ChatRoom[]>(`${this.baseUrl}/channels/discover`, { params });
  }

  // ── Legacy Room Endpoints (still used for room messages) ──

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

  sendChatRoomMessage(roomId: number, content: string, fileAttachmentId?: number, linkedEntityType?: string, linkedEntityId?: number): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/rooms/${roomId}/messages`, { content, recipientId: 0, fileAttachmentId, linkedEntityType, linkedEntityId });
  }

  uploadChatFile(channelId: number, file: File): Observable<ChatFileAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ChatFileAttachment>(`/api/v1/chat-rooms/${channelId}/files`, formData);
  }

  addRoomMember(roomId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rooms/${roomId}/members/${userId}`, {});
  }

  removeRoomMember(roomId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/rooms/${roomId}/members/${userId}`);
  }
}
