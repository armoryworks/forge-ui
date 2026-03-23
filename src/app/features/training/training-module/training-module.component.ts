import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

import { TrainingService } from '../services/training.service';
import { TrainingModuleDetail } from '../models/training-module.model';
import { ArticleContent } from '../models/article-content.model';
import { VideoContent } from '../models/video-content.model';
import { WalkthroughContent } from '../models/walkthrough-content.model';
import { QuickRefContent } from '../models/quickref-content.model';
import { QuizContent } from '../models/quiz-content.model';
import { TrainingModuleQuizComponent } from './training-module-quiz.component';

@Component({
  selector: 'app-training-module',
  standalone: true,
  imports: [LoadingBlockDirective, TrainingModuleQuizComponent],
  templateUrl: './training-module.component.html',
  styleUrl: './training-module.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingModuleComponent implements OnInit {
  private readonly trainingService = inject(TrainingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly isLoading = signal(true);
  protected readonly module = signal<TrainingModuleDetail | null>(null);
  protected readonly isCompleting = signal(false);
  protected readonly completed = signal(false);

  protected readonly articleContent = computed<ArticleContent | null>(() => {
    const m = this.module();
    if (!m || m.contentType !== 'Article') return null;
    try { return JSON.parse(m.contentJson) as ArticleContent; } catch { return null; }
  });

  protected readonly videoContent = computed<VideoContent | null>(() => {
    const m = this.module();
    if (!m || m.contentType !== 'Video') return null;
    try { return JSON.parse(m.contentJson) as VideoContent; } catch { return null; }
  });

  protected readonly walkthroughContent = computed<WalkthroughContent | null>(() => {
    const m = this.module();
    if (!m || m.contentType !== 'Walkthrough') return null;
    try { return JSON.parse(m.contentJson) as WalkthroughContent; } catch { return null; }
  });

  protected readonly quickRefContent = computed<QuickRefContent | null>(() => {
    const m = this.module();
    if (!m || m.contentType !== 'QuickRef') return null;
    try { return JSON.parse(m.contentJson) as QuickRefContent; } catch { return null; }
  });

  protected readonly quizContent = computed<QuizContent | null>(() => {
    const m = this.module();
    if (!m || m.contentType !== 'Quiz') return null;
    try { return JSON.parse(m.contentJson) as QuizContent; } catch { return null; }
  });

  protected readonly videoEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const v = this.videoContent();
    if (!v) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(v.embedUrl);
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.trainingService.getModule(id).subscribe({
      next: module => {
        this.module.set(module);
        this.isLoading.set(false);
        this.trainingService.recordStart(id).subscribe();
        this.completed.set(module.myStatus === 'Completed');
      },
      error: () => this.isLoading.set(false),
    });

    // Heartbeat every 30 seconds
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.module()) {
          this.trainingService.recordHeartbeat(id, 30).subscribe();
        }
      });
  }

  protected markComplete(): void {
    const m = this.module();
    if (!m) return;
    this.isCompleting.set(true);
    this.trainingService.completeModule(m.id).subscribe({
      next: () => {
        this.completed.set(true);
        this.isCompleting.set(false);
      },
      error: () => this.isCompleting.set(false),
    });
  }

  protected startWalkthrough(): void {
    const content = this.walkthroughContent();
    if (!content) return;
    this.router.navigateByUrl(content.appRoute).then(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      import('driver.js').then(({ driver }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (driver as any)({ animate: true, overlayOpacity: 0.5 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d.setSteps(content.steps as any);
        d.drive();
      }).catch(() => {
        // driver.js not available — navigation already completed
      });
    });
  }

  protected goBack(): void {
    this.router.navigate(['/training/library']);
  }

  protected onQuizComplete(passed: boolean): void {
    if (passed) this.completed.set(true);
  }

  protected formatSeconds(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
