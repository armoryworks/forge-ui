import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { SequencesService } from '../../services/sequences.service';
import { SequenceInstance } from '../../models/sequence.model';
import { SequenceInstancePanelComponent } from '../instance-detail-panel/instance-detail-panel.component';

/**
 * Embeds a job's running gated-sequence instances (subjectEntityType=Job) on the
 * job detail — the "Gates" section. Self-hides when the job has no running
 * sequence, so it only appears where the engine is actually driving a job.
 * Rendered capability-gated (CAP-CROSS-SEQUENCES) by the host panel.
 */
@Component({
  selector: 'app-job-gates-section',
  standalone: true,
  imports: [TranslatePipe, SequenceInstancePanelComponent],
  templateUrl: './job-gates-section.component.html',
  styleUrl: './job-gates-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobGatesSectionComponent {
  private readonly service = inject(SequencesService);

  readonly jobId = input.required<number>();

  protected readonly instances = signal<SequenceInstance[]>([]);

  constructor() {
    effect(() => {
      const id = this.jobId();
      if (id > 0) this.load(id);
    });
  }

  private load(jobId: number): void {
    this.service.getInstances({ subjectEntityType: 'Job', subjectEntityId: jobId, status: 'Running' })
      .subscribe({ next: (list) => this.instances.set(list) });
  }

  protected onChanged(): void {
    this.load(this.jobId());
  }
}
