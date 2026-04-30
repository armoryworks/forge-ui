import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { isCapabilityDisabledError } from '../errors/capability-disabled.error';
import {
  Announcement,
  AnnouncementAcknowledgment,
  AnnouncementTemplate,
  CreateAnnouncementRequest,
  CreateAnnouncementTemplateRequest,
} from '../models/announcement.model';

type AnnouncementListener = (announcement: Announcement) => void;

@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  private readonly http = inject(HttpClient);

  readonly activeAnnouncements = signal<Announcement[]>([]);
  readonly pendingAnnouncements = computed(() =>
    this.activeAnnouncements().filter(a => a.requiresAcknowledgment && !a.isAcknowledgedByCurrentUser));
  readonly unacknowledgedCount = computed(() => this.pendingAnnouncements().length);
  /** Phase 4 Phase-D — true when announcements capability is disabled. */
  readonly capabilityDisabled = signal(false);

  private readonly createdListeners = new Set<AnnouncementListener>();

  /** Subscribe to real-time announcement-received events. Returns an unsubscribe function. */
  onAnnouncementCreated(listener: AnnouncementListener): () => void {
    this.createdListeners.add(listener);
    return () => this.createdListeners.delete(listener);
  }

  loadActive(): void {
    this.http.get<Announcement[]>('/api/v1/announcements').subscribe({
      next: announcements => {
        this.activeAnnouncements.set(announcements);
        this.capabilityDisabled.set(false);
      },
      error: err => {
        if (isCapabilityDisabledError(err)) {
          // Announcements feature is intentionally off — render nothing.
          this.activeAnnouncements.set([]);
          this.capabilityDisabled.set(true);
        }
        // Other errors flow through the global interceptor (toast).
      },
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
    this.activeAnnouncements.update(list =>
      list.some(a => a.id === announcement.id) ? list : [announcement, ...list]);
    for (const listener of this.createdListeners) listener(announcement);
  }

  markAcknowledged(id: number): void {
    this.activeAnnouncements.update(list =>
      list.map(a => a.id === id ? { ...a, isAcknowledgedByCurrentUser: true, acknowledgmentCount: a.acknowledgmentCount + 1 } : a));
  }
}
