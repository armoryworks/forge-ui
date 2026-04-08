import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { DraftService } from './draft.service';
import {
  DraftRecoveryPromptComponent,
  DraftRecoveryPromptData,
  DraftRecoveryPromptResult,
} from '../components/draft-recovery-prompt/draft-recovery-prompt.component';
import {
  LogoutDraftsDialogComponent,
  LogoutDraftsDialogData,
  LogoutDraftsDialogResult,
} from '../components/logout-drafts-dialog/logout-drafts-dialog.component';

const TTL_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

@Injectable({ providedIn: 'root' })
export class DraftRecoveryService {
  private readonly draftService = inject(DraftService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  private ttlTimerId: ReturnType<typeof setTimeout> | null = null;

  async onLogin(): Promise<void> {
    await this.draftService.refreshHasDrafts();

    const drafts = await this.draftService.getUserDrafts();
    if (drafts.length > 0) {
      this.showRecoveryPrompt(drafts);
    }

    // Schedule TTL cleanup after grace period
    this.scheduleTtlCheck();
  }

  /**
   * Called before logout. Returns true if logout should proceed.
   */
  async checkBeforeLogout(): Promise<boolean> {
    const drafts = await this.draftService.getUserDrafts();
    if (drafts.length === 0) {
      return true;
    }

    const result = await firstValueFrom(
      this.dialog
        .open<LogoutDraftsDialogComponent, LogoutDraftsDialogData, LogoutDraftsDialogResult>(
          LogoutDraftsDialogComponent,
          {
            width: '520px',
            data: { drafts },
          },
        )
        .afterClosed(),
    );

    if (!result || result.action === 'cancel') {
      return false;
    }

    if (result.action === 'navigate' && result.draft) {
      this.router.navigateByUrl(result.draft.route);
      return false;
    }

    // action === 'logout' — drafts stay in IndexedDB for recovery on next login
    return true;
  }

  cancelTtlCheck(): void {
    if (this.ttlTimerId) {
      clearTimeout(this.ttlTimerId);
      this.ttlTimerId = null;
    }
  }

  private scheduleTtlCheck(): void {
    this.cancelTtlCheck();
    this.ttlTimerId = setTimeout(() => this.runTtlCheck(), TTL_GRACE_PERIOD_MS);
  }

  private async runTtlCheck(): Promise<void> {
    const expired = await this.draftService.getExpiredDrafts();
    if (expired.length === 0) return;

    this.showExpiryPrompt(expired);
  }

  private showRecoveryPrompt(drafts: import('../models/draft.model').Draft[]): void {
    this.dialog
      .open<DraftRecoveryPromptComponent, DraftRecoveryPromptData, DraftRecoveryPromptResult>(
        DraftRecoveryPromptComponent,
        {
          width: '520px',
          data: { drafts, mode: 'recovery' },
        },
      )
      .afterClosed()
      .subscribe((result) => this.handlePromptResult(result));
  }

  private showExpiryPrompt(drafts: import('../models/draft.model').Draft[]): void {
    this.dialog
      .open<DraftRecoveryPromptComponent, DraftRecoveryPromptData, DraftRecoveryPromptResult>(
        DraftRecoveryPromptComponent,
        {
          width: '520px',
          data: { drafts, mode: 'expiry' },
        },
      )
      .afterClosed()
      .subscribe((result) => this.handlePromptResult(result));
  }

  private handlePromptResult(result: DraftRecoveryPromptResult | undefined): void {
    if (!result) return;

    switch (result.action) {
      case 'navigate':
        if (result.draft) {
          // Restoring one resets TTL on all
          this.draftService.resetAllTtl();
          this.router.navigateByUrl(result.draft.route);
        }
        break;

      case 'keep':
        this.draftService.resetAllTtl();
        break;

      case 'discard':
        this.draftService.getUserDrafts().then((drafts) => {
          for (const draft of drafts) {
            this.draftService.clearDraft(draft.entityType, draft.entityId);
          }
        });
        break;

      case 'dismiss':
        // Do nothing — drafts remain, TTL continues
        break;
    }
  }
}
