import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ActivityItem } from '../models/activity.model';
import { EntityNote } from '../models/entity-note.model';
import { MentionUser } from '../models/mention-user.model';

interface ActivityResponse {
  id: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string;
  userInitials: string | null;
  userName: string | null;
  createdAt: string;
}

interface NoteResponse {
  id: number;
  text: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  createdAt: string;
  updatedAt: string | null;
}

interface UserResponse {
  id: number;
  name: string;
  initials: string;
  color: string;
}

@Injectable({ providedIn: 'root' })
export class EntityActivityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getActivity(entityType: string, entityId: number): Observable<ActivityItem[]> {
    return this.http.get<ActivityResponse[]>(
      `${this.apiUrl}/${entityType}/${entityId}/activity`,
    ).pipe(map(items => items.map(this.mapActivity)));
  }

  getHistory(entityType: string, entityId: number): Observable<ActivityItem[]> {
    return this.http.get<ActivityResponse[]>(
      `${this.apiUrl}/${entityType}/${entityId}/history`,
    ).pipe(map(items => items.map(this.mapActivity)));
  }

  getNotes(entityType: string, entityId: number): Observable<EntityNote[]> {
    return this.http.get<NoteResponse[]>(
      `${this.apiUrl}/${entityType}/${entityId}/notes`,
    ).pipe(map(items => items.map(this.mapNote)));
  }

  createNote(
    entityType: string,
    entityId: number,
    text: string,
    mentionedUserIds: number[] = [],
  ): Observable<EntityNote> {
    return this.http.post<NoteResponse>(
      `${this.apiUrl}/${entityType}/${entityId}/notes`,
      { text, mentionedUserIds },
    ).pipe(map(this.mapNote));
  }

  deleteNote(entityType: string, entityId: number, noteId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${entityType}/${entityId}/notes/${noteId}`,
    );
  }

  postComment(
    entityType: string,
    entityId: number,
    comment: string,
    mentionedUserIds: number[] = [],
  ): Observable<ActivityItem> {
    return this.http.post<ActivityResponse>(
      `${this.apiUrl}/${entityType}/${entityId}/comments`,
      { comment, mentionedUserIds },
    ).pipe(map(this.mapActivity));
  }

  getMentionUsers(): Observable<MentionUser[]> {
    return this.http.get<UserResponse[]>(`${this.apiUrl}/users`).pipe(
      map(users => users.map(u => ({
        id: u.id,
        name: u.name,
        initials: u.initials,
        color: u.color,
      }))),
    );
  }

  private mapActivity(item: ActivityResponse): ActivityItem {
    return {
      id: item.id,
      description: item.description,
      createdAt: new Date(item.createdAt),
      userInitials: item.userInitials ?? undefined,
      action: item.action,
    };
  }

  private mapNote(item: NoteResponse): EntityNote {
    return {
      id: item.id,
      text: item.text,
      authorName: item.authorName,
      authorInitials: item.authorInitials,
      authorColor: item.authorColor,
      createdAt: new Date(item.createdAt),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
    };
  }
}
