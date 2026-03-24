import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TrainingService } from '../../../training/services/training.service';
import { UserTrainingDetail } from '../../../training/models/user-training-detail.model';

@Component({
  selector: 'app-user-training-detail-panel',
  standalone: true,
  imports: [DatePipe, LoadingBlockDirective, EmptyStateComponent],
  templateUrl: './user-training-detail-panel.component.html',
  styleUrl: './user-training-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserTrainingDetailPanelComponent {
  private readonly trainingService = inject(TrainingService);

  readonly userId = input.required<number>();

  protected readonly isLoading = signal(false);
  protected readonly detail = signal<UserTrainingDetail | null>(null);

  constructor() {
    effect(() => {
      const id = this.userId();
      if (!id) return;
      this.isLoading.set(true);
      this.trainingService.getUserTrainingDetail(id).subscribe({
        next: d => { this.detail.set(d); this.isLoading.set(false); },
        error: () => this.isLoading.set(false),
      });
    });
  }

  protected statusClass(status: string | null): string {
    switch (status) {
      case 'Completed':  return 'chip--success';
      case 'InProgress': return 'chip--info';
      default:           return 'chip--muted';
    }
  }

  protected statusLabel(status: string | null): string {
    switch (status) {
      case 'Completed':  return 'Completed';
      case 'InProgress': return 'In Progress';
      default:           return 'Not Started';
    }
  }

  protected contentTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      Article: 'article', Video: 'play_circle',
      Walkthrough: 'route', QuickRef: 'quick_reference_all', Quiz: 'quiz',
    };
    return icons[type] ?? 'school';
  }

  protected formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  protected completedCount(detail: UserTrainingDetail): number {
    return detail.modules.filter(m => m.status === 'Completed').length;
  }
}
