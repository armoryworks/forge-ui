import { Injectable, inject } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';
import { UserPreferencesService } from './user-preferences.service';

/** Per-user preference key controlling the confirm-before-send safety prompt. */
export const CONFIRM_BEFORE_SEND_PREF_KEY = 'email:confirmBeforeSend';

export interface ConfirmSendOptions {
  titleKey: string;
  messageKey: string;
  messageParams?: Record<string, unknown>;
  confirmLabelKey?: string; // default 'confirmSend.confirm'
}

/**
 * Two-step "Would you like to send this?" safety gate for every action that
 * dispatches an email/message to an external party (customer, vendor, employee).
 *
 * The prompt is ON by default and can be turned off per-user via the
 * `email:confirmBeforeSend` preference (Account > Customization).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmSendService {
  private readonly dialog = inject(MatDialog);
  private readonly preferences = inject(UserPreferencesService);
  private readonly translate = inject(TranslateService);

  /**
   * Emits `true` when the send should proceed (preference off, or user
   * confirmed) and `false` when the user cancelled. Completes after one emit.
   */
  confirmSend(options: ConfirmSendOptions): Observable<boolean> {
    // Default ON when the preference has never been set (get() returns null).
    const enabled = this.preferences.get<boolean>(CONFIRM_BEFORE_SEND_PREF_KEY) ?? true;
    if (!enabled) return of(true);

    return this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant(options.titleKey),
        message: this.translate.instant(options.messageKey, options.messageParams),
        confirmLabel: this.translate.instant(options.confirmLabelKey ?? 'confirmSend.confirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().pipe(map(confirmed => confirmed === true));
  }
}
