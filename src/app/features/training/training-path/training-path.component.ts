import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { DetailLoadErrorComponent } from '../../../shared/components/detail-load-error/detail-load-error.component';
import { notFoundError } from '../../../shared/utils/not-found-error';
import { parsePositiveId } from '../../../shared/utils/parse-positive-id';

import { TrainingService } from '../services/training.service';
import { TrainingPath } from '../models/training-path.model';
import { TrainingContentType } from '../models/training-content-type.enum';
import { TrainingProgressStatus } from '../models/training-progress-status.enum';
import { EnumLabelPipe } from '../../../shared/pipes/enum-label.pipe';

@Component({
  selector: 'app-training-path',
  standalone: true,
  imports: [EnumLabelPipe, LoadingBlockDirective, EmptyStateComponent, RouterLink, DetailLoadErrorComponent],
  templateUrl: './training-path.component.html',
  styleUrl: './training-path.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPathComponent implements OnInit {
  private readonly trainingService = inject(TrainingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(true);
  protected readonly path = signal<TrainingPath | null>(null);
  protected readonly loadError = signal<unknown>(null);
  /** This path's URL, passed as `?from=` so a module's Back returns here. */
  protected readonly currentUrl = signal('');

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);
    this.load();
  }

  protected load(): void {
    const id = parsePositiveId(this.route.snapshot.paramMap.get('id'));
    this.loadError.set(null);
    if (!id) {
      this.loadError.set(notFoundError());
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    this.trainingService.getPath(id).subscribe({
      next: path => {
        this.path.set(path);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(err);
        this.isLoading.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/training/paths']);
  }

  protected contentTypeIcon(type: TrainingContentType): string {
    const icons: Record<TrainingContentType, string> = {
      Article: 'article',
      Walkthrough: 'route',
      QuickRef: 'quick_reference_all',
      Quiz: 'quiz',
      Reference: 'menu_book',
    };
    return icons[type] ?? 'school';
  }

  protected moduleActionLabel(status: TrainingProgressStatus | null): string {
    if (status === 'Completed') return 'Review';
    if (status === 'InProgress') return 'Continue';
    return 'Start';
  }

  protected moduleStatusClass(status: TrainingProgressStatus | null): string {
    if (status === 'Completed') return 'chip chip--success';
    if (status === 'InProgress') return 'chip chip--info';
    return 'chip chip--muted';
  }

  protected completedCount(): number {
    return this.path()?.modules.filter(m => m.myStatus === 'Completed').length ?? 0;
  }

  protected progressPercent(): number {
    const p = this.path();
    if (!p || p.modules.length === 0) return 0;
    return Math.round((this.completedCount() / p.modules.length) * 100);
  }
}
