import { effect, inject, Injectable, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { AuthService } from './auth.service';
import { DraftStorageService } from './draft-storage.service';
import { DraftBroadcastService } from './draft-broadcast.service';
import { UserPreferencesService } from './user-preferences.service';
import { SnackbarService } from './snackbar.service';
import { Draft } from '../models/draft.model';
import { DraftableForm } from '../models/draftable-form.model';
import { DEFAULT_DRAFT_TTL } from '../models/draft-ttl.model';

const DEBOUNCE_MS = 2500;
const PREF_KEY = 'draft:ttlMs';

interface Registration {
  form: DraftableForm;
  subscription: Subscription;
  beforeunloadHandler: (e: BeforeUnloadEvent) => void;
}

@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(DraftStorageService);
  private readonly broadcast = inject(DraftBroadcastService);
  private readonly preferences = inject(UserPreferencesService);
  private readonly snackbar = inject(SnackbarService);

  private readonly registrations = new Map<string, Registration>();

  /** Whether the current user has any drafts in IndexedDB. */
  readonly hasDrafts = signal(false);

  /** Key of the currently active (registered) draft being edited. */
  readonly activeDraftKey = signal<string | null>(null);

  constructor() {
    // React to cross-tab broadcast events
    effect(() => {
      const event = this.broadcast.lastEvent();
      if (!event) return;

      switch (event.type) {
        case 'draft-updated':
          this.handleRemoteDraftUpdate(event.key, event.draft);
          break;
        case 'draft-cleared':
          this.handleRemoteDraftClear(event.key);
          break;
        case 'entity-saved':
          this.handleRemoteEntitySaved(event.entityType, event.entityId);
          break;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  register(form: DraftableForm): void {
    const key = this.buildKey(form.entityType, form.entityId);

    // Tear down any existing registration for this key
    this.unregisterByKey(key);

    // Debounced auto-save on value changes
    const change$ = new Subject<void>();
    const subscription = change$.pipe(debounceTime(DEBOUNCE_MS)).subscribe(() => {
      if (form.isDirty()) {
        this.saveDraft(form);
      }
    });

    // Pipe form valueChanges into the debounce subject
    const formSub = form.form.valueChanges.subscribe(() => change$.next());
    subscription.add(formSub);

    // beforeunload warning
    const beforeunloadHandler = (e: BeforeUnloadEvent) => {
      if (form.isDirty()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeunloadHandler);

    this.registrations.set(key, { form, subscription, beforeunloadHandler });
    this.activeDraftKey.set(key);
  }

  unregister(entityType: string, entityId: string): void {
    const key = this.buildKey(entityType, entityId);
    this.unregisterByKey(key);

    if (this.activeDraftKey() === key) {
      this.activeDraftKey.set(null);
    }
  }

  private unregisterByKey(key: string): void {
    const existing = this.registrations.get(key);
    if (existing) {
      existing.subscription.unsubscribe();
      window.removeEventListener('beforeunload', existing.beforeunloadHandler);
      this.registrations.delete(key);
    }
  }

  // ---------------------------------------------------------------------------
  // Draft CRUD
  // ---------------------------------------------------------------------------

  async saveDraft(form: DraftableForm): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;

    const key = this.buildKey(form.entityType, form.entityId);
    const draft: Draft = {
      key,
      userId,
      entityType: form.entityType,
      entityId: form.entityId,
      displayLabel: form.displayLabel,
      route: form.route,
      formData: form.getFormSnapshot(),
      lastModified: Date.now(),
    };

    await this.storage.put(draft);
    this.hasDrafts.set(true);
    this.broadcast.broadcastDraftUpdated(key, draft);
  }

  async loadDraft(entityType: string, entityId: string): Promise<Draft | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    const key = this.buildKey(entityType, entityId);
    return this.storage.get(key);
  }

  async clearDraft(entityType: string, entityId: string): Promise<void> {
    const key = this.buildKey(entityType, entityId);
    await this.storage.delete(key);
    this.broadcast.broadcastDraftCleared(key);
    await this.refreshHasDrafts();
  }

  async clearDraftAndBroadcastSave(entityType: string, entityId: string): Promise<void> {
    const key = this.buildKey(entityType, entityId);
    await this.storage.delete(key);
    this.broadcast.broadcastEntitySaved(entityType, entityId);
    await this.refreshHasDrafts();
  }

  // ---------------------------------------------------------------------------
  // User drafts (recovery / logout)
  // ---------------------------------------------------------------------------

  async getUserDrafts(): Promise<Draft[]> {
    const userId = this.auth.user()?.id;
    if (!userId) return [];
    return this.storage.getByUser(userId);
  }

  async resetAllTtl(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    await this.storage.resetTtlForUser(userId);
  }

  async getExpiredDrafts(): Promise<Draft[]> {
    const drafts = await this.getUserDrafts();
    const ttl = this.getTtl();
    const now = Date.now();
    return drafts.filter(d => d.lastModified + ttl < now);
  }

  async purgeExpired(): Promise<string[]> {
    const expired = await this.getExpiredDrafts();
    for (const draft of expired) {
      await this.storage.delete(draft.key);
    }
    await this.refreshHasDrafts();
    return expired.map(d => d.key);
  }

  async refreshHasDrafts(): Promise<void> {
    const drafts = await this.getUserDrafts();
    this.hasDrafts.set(drafts.length > 0);
  }

  // ---------------------------------------------------------------------------
  // TTL
  // ---------------------------------------------------------------------------

  getTtl(): number {
    return this.preferences.get<number>(PREF_KEY) ?? DEFAULT_DRAFT_TTL;
  }

  // ---------------------------------------------------------------------------
  // Cross-tab event handlers
  // ---------------------------------------------------------------------------

  private handleRemoteDraftUpdate(key: string, draft: Draft): void {
    const reg = this.registrations.get(key);
    if (reg) {
      // Another tab is editing the same form — restore their changes
      reg.form.restoreDraft(draft.formData);
      this.snackbar.info('Updated from another tab');
    }
  }

  private handleRemoteDraftClear(key: string): void {
    const reg = this.registrations.get(key);
    if (reg) {
      this.snackbar.info('Draft discarded in another tab');
    }
    this.refreshHasDrafts();
  }

  private handleRemoteEntitySaved(entityType: string, entityId: string): void {
    const key = this.buildKey(entityType, entityId);
    const reg = this.registrations.get(key);
    if (reg) {
      this.snackbar.info('This record was saved in another tab');
    }
    // Clear local draft — the server version is now authoritative
    this.storage.delete(key);
    this.refreshHasDrafts();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildKey(entityType: string, entityId: string): string {
    const userId = this.auth.user()?.id ?? 0;
    return `${userId}:${entityType}:${entityId}`;
  }
}
