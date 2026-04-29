import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';

export type NewPartChoice = 'express' | 'guided';

/**
 * Workflow Pattern Phase 5 — "How would you like to add this part?" fork
 * shown when the user clicks New Part on the list page. Two choices:
 *   • Express add — single-form quick path (raw materials, simple parts).
 *   • Step-by-step setup — guided workflow (assemblies, complex parts).
 *
 * The user's choice routes to the right downstream UI: express stays on
 * /parts and opens the existing dialog; guided spawns a workflow run and
 * navigates to /parts/{id}?workflow=part-assembly-guided-v1.
 */
@Component({
  selector: 'app-new-part-fork-dialog',
  standalone: true,
  imports: [TranslatePipe, DialogComponent],
  templateUrl: './new-part-fork-dialog.component.html',
  styleUrl: './new-part-fork-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewPartForkDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewPartForkDialogComponent, NewPartChoice | undefined>);

  protected pick(choice: NewPartChoice): void {
    this.dialogRef.close(choice);
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
