import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TranslatePipe } from '@ngx-translate/core';

import { Stage } from '../../../../shared/models/stage.model';
import { isBillingStage } from '../../../../shared/utils/billing-stage';

interface StageChoice {
  stage: Stage;
  disabledReasonKey: string | null;
}

/**
 * A job's stage as a colour-coded menu button. The menu lists the stages of the job's own
 * track type and refuses the same targets a board drag refuses (an irreversible stage, a
 * billing stage the user may not enter); the parent makes the move through the same API.
 */
@Component({
  selector: 'app-job-stage-select',
  standalone: true,
  imports: [MatMenuModule, MatTooltipModule, TranslatePipe],
  templateUrl: './job-stage-select.component.html',
  styleUrl: './job-stage-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobStageSelectComponent {
  readonly jobNumber = input.required<string>();
  readonly stageName = input.required<string>();
  readonly stageColor = input.required<string>();
  readonly currentStageId = input<number | null>(null);
  readonly stages = input<readonly Stage[]>([]);
  readonly readonly = input(false);
  readonly mayBill = input(false);

  readonly moveRequested = output<Stage>();

  protected readonly choices = computed<StageChoice[]>(() => {
    const currentId = this.currentStageId();
    const mayBill = this.mayBill();
    return [...this.stages()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(stage => ({
        stage,
        disabledReasonKey: stage.id === currentId
          ? 'jobsTable.stageCurrent'
          : stage.isIrreversible
            ? 'jobsTable.stageIrreversible'
            : !mayBill && isBillingStage(stage.accountingDocumentType)
              ? 'kanban.bulkMoveBillingReason'
              : null,
      }));
  });

  protected readonly canOpen = computed(() => !this.readonly() && this.choices().some(c => c.disabledReasonKey === null));

  protected select(choice: StageChoice): void {
    if (choice.disabledReasonKey === null) this.moveRequested.emit(choice.stage);
  }
}
