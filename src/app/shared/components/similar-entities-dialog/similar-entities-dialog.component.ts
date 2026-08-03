import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../dialog/dialog.component';

export interface SimilarEntitiesDialogData {
  /** The name the user typed and is about to create. */
  typedTerm: string;
  /** Singular noun for the entity, e.g. "part". */
  createNewLabel: string;
  /** Row key for the primary line (mirrors the picker's displayField). */
  displayField: string;
  /** Optional row key for a muted subtitle (mirrors secondaryDisplayField). */
  secondaryDisplayField: string | null;
  /** Existing entities that look similar to typedTerm. */
  candidates: Record<string, unknown>[];
}

export type SimilarEntitiesDialogResult =
  | { action: 'select'; entity: Record<string, unknown> }
  | { action: 'create' }
  | undefined;

/**
 * "Did you mean one of these?" — shown before creating a new entity when the
 * near-duplicate guard finds existing entities with a similar name. The user
 * either picks an existing one (no duplicate created) or confirms creating the
 * new one anyway. Generic over entity type; the picker passes its display
 * fields so the rows render the same way as its result list.
 */
@Component({
  selector: 'app-similar-entities-dialog',
  standalone: true,
  imports: [DialogComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [title]="'similarEntities.title' | translate" width="480px" (closed)="cancel()">
      <p class="similar-entities__intro">
        {{ 'similarEntities.intro' | translate:{ term: data.typedTerm, label: data.createNewLabel } }}
      </p>
      <ul class="similar-entities__list">
        @for (c of data.candidates; track c['id']) {
          <li class="similar-entities__item">
            <div class="similar-entities__text">
              <span class="similar-entities__primary">{{ primary(c) }}</span>
              @if (secondary(c)) {
                <span class="similar-entities__secondary">{{ secondary(c) }}</span>
              }
            </div>
            <button type="button" class="action-btn action-btn--sm" (click)="use(c)">
              {{ 'similarEntities.useThis' | translate }}
            </button>
          </li>
        }
      </ul>
      <div dialog-footer>
        <button type="button" class="action-btn" (click)="cancel()">{{ 'common.cancel' | translate }}</button>
        <button type="button" class="action-btn action-btn--create" (click)="createNew()">
          {{ 'similarEntities.createAnyway' | translate:{ term: data.typedTerm } }}
        </button>
      </div>
    </app-dialog>
  `,
  styles: [`
    .similar-entities__intro { margin: 0 0 12px; }
    .similar-entities__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .similar-entities__item {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 8px 12px; border: 1px solid var(--border); background: var(--surface);
    }
    .similar-entities__text { display: flex; flex-direction: column; min-width: 0; }
    .similar-entities__primary { font-weight: 600; }
    .similar-entities__secondary { font-size: var(--font-size-sm); color: var(--text-secondary); }
  `],
})
export class SimilarEntitiesDialogComponent {
  protected readonly data = inject<SimilarEntitiesDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<SimilarEntitiesDialogComponent, SimilarEntitiesDialogResult>>(MatDialogRef);

  protected primary(e: Record<string, unknown>): string {
    return String(e[this.data.displayField] ?? '');
  }

  protected secondary(e: Record<string, unknown>): string {
    const key = this.data.secondaryDisplayField;
    if (!key) return '';
    const v = e[key];
    return v == null ? '' : String(v);
  }

  protected use(entity: Record<string, unknown>): void {
    this.dialogRef.close({ action: 'select', entity });
  }

  protected createNew(): void {
    this.dialogRef.close({ action: 'create' });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
