import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import {
  Announcement,
  AnnouncementAcknowledgment,
  AnnouncementTemplate,
  CreateAnnouncementRequest,
  CreateAnnouncementTemplateRequest,
} from '../models/announcement.model';

@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  private readonly http = inject(HttpClient);

  readonly activeAnnouncements = signal<Announcement[]>([]);
  readonly pendingAnnouncements = computed(() =>
    this.activeAnnouncements().filter(a => a.requiresAcknowledgment && !a.isAcknowledgedByCurrentUser));
  readonly unacknowledgedCount = computed(() => this.pendingAnnouncements().length);

  loadActive(): void {
    this.http.get<Announcement[]>('/api/v1/announcements').subscribe(announcements => {
      this.activeAnnouncements.set(announcements);
    });
  }

  getAll() {
    return this.http.get<Announcement[]>('/api/v1/announcements/all');
  }

  create(request: CreateAnnouncementRequest) {
    return this.http.post<Announcement>('/api/v1/announcements', request);
  }

  acknowledge(id: number) {
    return this.http.post<void>(`/api/v1/announcements/${id}/acknowledge`, {});
  }

  getAcknowledgments(id: number) {
    return this.http.get<AnnouncementAcknowledgment[]>(`/api/v1/announcements/${id}/acknowledgments`);
  }

  getTemplates() {
    return this.http.get<AnnouncementTemplate[]>('/api/v1/announcements/templates');
  }

  createTemplate(request: CreateAnnouncementTemplateRequest) {
    return this.http.post<AnnouncementTemplate>('/api/v1/announcements/templates', request);
  }

  deleteTemplate(id: number) {
    return this.http.delete<void>(`/api/v1/announcements/templates/${id}`);
  }

  pushAnnouncement(announcement: Announcement): void {
    this.activeAnnouncements.update(list => [announcement, ...list]);
  }

  markAcknowledged(id: number): void {
    this.activeAnnouncements.update(list =>
      list.map(a => a.id === id ? { ...a, isAcknowledgedByCurrentUser: true, acknowledgmentCount: a.acknowledgmentCount + 1 } : a));
  }
}
