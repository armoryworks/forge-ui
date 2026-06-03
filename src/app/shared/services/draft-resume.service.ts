import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Bridges a draft-recovery "Go to" navigation to the create dialog that owns
 * the draft.
 *
 * New-entity drafts (entityId 'new' / 'fork-new') live behind a create dialog
 * that is only instantiated when its list page opens it. Navigating to the list
 * route alone therefore "loads nothing" — the dialog never reopens. The
 * draft-recovery service appends `?resumeDraft=<entityType>:<entityId>` when it
 * navigates for such a draft; the destination list calls `consume(entityType)`
 * in its init and, on a match, opens its create dialog. The shared dialog then
 * restores the draft (via its `draftConfig`) and shows the recovery banner — the
 * existing behavior. The param is stripped on consume so a refresh doesn't
 * reopen the dialog.
 */
@Injectable({ providedIn: 'root' })
export class DraftResumeService {
  private readonly router = inject(Router);

  /** Query-param key carrying `"<entityType>:<entityId>"`. */
  static readonly PARAM = 'resumeDraft';

  /** Build the queryParams a navigation should carry to resume `entityType:entityId`. */
  static params(entityType: string, entityId: string): Record<string, string> {
    return { [DraftResumeService.PARAM]: `${entityType}:${entityId}` };
  }

  /**
   * If the current URL asks to resume a draft for `entityType`, strip the param
   * (so a refresh won't reopen) and return true. Component-agnostic — reads the
   * live router URL, so it works from any list's `ngOnInit`.
   */
  consume(entityType: string): boolean {
    const value = this.router.parseUrl(this.router.url).queryParams[DraftResumeService.PARAM] as string | undefined;
    if (!value || !value.startsWith(`${entityType}:`)) return false;
    // Remove just this param, preserve any others; replace so it's not in history.
    this.router.navigate([], {
      queryParams: { [DraftResumeService.PARAM]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    return true;
  }
}
