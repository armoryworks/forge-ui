import { Injectable, OnDestroy, signal } from '@angular/core';

import { Draft } from '../models/draft.model';

export type DraftBroadcastEvent =
  | { type: 'draft-updated'; key: string; draft: Draft }
  | { type: 'draft-cleared'; key: string }
  | { type: 'entity-saved'; entityType: string; entityId: string };

const CHANNEL_NAME = 'qb-engineer-draft-sync';

@Injectable({ providedIn: 'root' })
export class DraftBroadcastService implements OnDestroy {
  private channel: BroadcastChannel | null = null;

  /** Last event received from another tab (consumed by DraftService). */
  readonly lastEvent = signal<DraftBroadcastEvent | null>(null);

  initialize(): void {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event: MessageEvent<DraftBroadcastEvent>) => {
      this.lastEvent.set(event.data);
    };
  }

  broadcastDraftUpdated(key: string, draft: Draft): void {
    this.channel?.postMessage({ type: 'draft-updated', key, draft } satisfies DraftBroadcastEvent);
  }

  broadcastDraftCleared(key: string): void {
    this.channel?.postMessage({ type: 'draft-cleared', key } satisfies DraftBroadcastEvent);
  }

  broadcastEntitySaved(entityType: string, entityId: string): void {
    this.channel?.postMessage({ type: 'entity-saved', entityType, entityId } satisfies DraftBroadcastEvent);
  }

  ngOnDestroy(): void {
    this.channel?.close();
    this.channel = null;
  }
}
