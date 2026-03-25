import { ChangeDetectionStrategy, Component, DestroyRef, NgZone, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, interval } from 'rxjs';

import { MarkdownComponent } from 'ngx-markdown';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { createTourSvg, clearTourConnector, updateTourConnector, attachScrollRefresh, setupPopoverDraggable } from '../../../shared/utils/tour-connector.utils';

import { AuthService } from '../../../shared/services/auth.service';
import { TrainingService } from '../services/training.service';
import { TrainingModuleDetail } from '../models/training-module.model';
import { ArticleContent } from '../models/article-content.model';
import { WalkthroughContent } from '../models/walkthrough-content.model';
import { QuickRefContent } from '../models/quickref-content.model';
import { QuizContent } from '../models/quiz-content.model';
import { TrainingModuleQuizComponent } from './training-module-quiz.component';

@Component({
  selector: 'app-training-module',
  standalone: true,
  imports: [LoadingBlockDirective, TrainingModuleQuizComponent, MarkdownComponent],
  templateUrl: './training-module.component.html',
  styleUrl: './training-module.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingModuleComponent implements OnInit {
  private readonly trainingService = inject(TrainingService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  protected readonly isLoading = signal(true);
  protected readonly module = signal<TrainingModuleDetail | null>(null);
  protected readonly isCompleting = signal(false);
  protected readonly completed = signal(false);

  protected readonly isAdmin = computed(() => this.authService.hasAnyRole(['Admin', 'Manager']));

  // Reading timer — counts seconds spent on the page (pauses when tab is hidden)
  protected readonly elapsedSeconds = signal(0);

  protected readonly targetSeconds = computed(() => {
    const m = this.module();
    if (!m || this.completed()) return 0;
    // Walkthroughs complete via the tour interaction — no wait required
    if (m.contentType === 'Walkthrough') return 0;
    // QuickRef is a reference card — glance-and-done, very short minimum
    if (m.contentType === 'QuickRef') return Math.min(30, m.estimatedMinutes * 15);
    // Article: actual reading time, minimum 20 seconds
    return Math.max(20, m.estimatedMinutes * 60);
  });

  protected readonly timerProgress = computed(() => {
    const t = this.targetSeconds();
    if (t === 0) return 100;
    return Math.min(100, Math.round((this.elapsedSeconds() / t) * 100));
  });

  protected readonly timerComplete = computed(() =>
    this.completed() || this.timerProgress() >= 100,
  );

  protected readonly canComplete = computed(() => this.timerComplete());

  protected readonly timerVerb = computed((): string => {
    const type = this.module()?.contentType;
    if (type === 'QuickRef') return 'Reviewing';
    return 'Reading';
  });

  protected readonly timerRemaining = computed((): string | null => {
    const remaining = Math.max(0, this.targetSeconds() - this.elapsedSeconds());
    if (remaining === 0) return null;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
  });

  protected readonly articleContent = computed<ArticleContent | null>(() => {
    const m = this.module();
    if (!m || m.contentType !== 'Article') return null;
    try { return JSON.parse(m.contentJson) as ArticleContent; } catch { return null; }
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

  /** Extracts H2/H3 headings from the article body markdown for the visual overview panel */
  protected readonly articleHeadings = computed<string[]>(() => {
    const body = this.articleContent()?.body ?? '';
    if (!body) return [];
    return body.split('\n')
      .filter(l => l.startsWith('## ') || l.startsWith('### '))
      .map(l => l.replace(/^#{2,3}\s+/, '').trim())
      .filter(Boolean);
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

    // Reading timer: tick every second, pause when tab is hidden
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.module() && !document.hidden && !this.timerComplete()) {
          this.elapsedSeconds.update(s => s + 1);
        }
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
    if (!m || !this.canComplete()) return;
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

    // Navigate to the target page and embed ?walkthrough=<moduleId> so the URL
    // reflects that a guided tour is in progress (URL-as-source-of-truth).
    // NOTE: Use ?walkthrough= (not ?tutorial=) to avoid AppComponent's
    // watchWalkthroughUrl interceptor, which watches ?tutorial= to resume
    // HelpTourService tours on page reload — a different code path that would
    // start a second parallel driver.js instance and steal the Done navigation.
    const moduleId = this.module()?.id ?? 'training';
    const sep = content.appRoute.includes('?') ? '&' : '?';
    const targetUrl = `${content.appRoute}${sep}walkthrough=${moduleId}`;

    // Capture references — component may be destroyed before tour ends
    const router = this.router;
    const trainingService = this.trainingService;
    const numericModuleId = this.module()?.id;
    const ngZone = this.ngZone;

    router.navigateByUrl(targetUrl).then(() => {
      import('driver.js').then(({ driver }) => {
        const svg = createTourSvg();
        document.body.appendChild(svg);
        const removeScrollRefresh = attachScrollRefresh(svg);

        // Guard against double-cleanup (onNextClick for Done + onDestroyed for close/escape)
        let cleanedUp = false;
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          removeScrollRefresh();
          svg.remove();
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (driver as any)({
          animate: true,
          overlayOpacity: 0,
          popoverOffset: 20,
          allowClose: true,
          popoverClass: 'qb-tour-popover',
          doneBtnText: '<span class="material-icons-outlined" aria-hidden="true">check</span>Done',
          onHighlighted: () => {
            requestAnimationFrame(() => {
              updateTourConnector(svg, { center: true });
              setupPopoverDraggable();
            });
          },
          onDeselected: () => {
            clearTourConnector(svg);
          },
          // Intercept every Next/Done click so we control last-step behavior.
          // driver.js only fires onDestroyed if __activeElement is still set,
          // which can be lost in zoneless apps. onNextClick fires reliably.
          onNextClick: () => {
            if (d.hasNextStep()) {
              d.moveNext();
            } else {
              // Done button on last step.
              // 1. Remove our SVG overlay immediately.
              cleanup();
              // 2. Navigate first — defer d.destroy() to the next macrotask so
              //    driver.js DOM cleanup (focus restoration, body class removal)
              //    does not race against Angular's router navigation.
              ngZone.run(() => {
                if (numericModuleId) {
                  trainingService.completeModule(numericModuleId).subscribe({
                    error: () => { /* swallow — navigation proceeds regardless */ },
                  });
                  router.navigateByUrl(`/training/module/${numericModuleId}`);
                } else {
                  router.navigateByUrl('/training/library');
                }
              });
              setTimeout(() => d.destroy(), 0);
            }
          },
          // Handles close button / Escape key (not the Done button)
          onDestroyed: () => {
            cleanup();
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d.setSteps(content.steps as any);
        d.drive();

        // Destroy tour if the user navigates away (back button, sidebar, etc.)
        // before completing it — prevents orphaned overlays on unrelated pages.
        const navSub = router.events
          .pipe(filter(e => e instanceof NavigationStart))
          .subscribe(() => {
            navSub.unsubscribe();
            cleanup();
            setTimeout(() => { try { d.destroy(); } catch { /* already destroyed */ } }, 0);
          });
      }).catch(() => {
        // driver.js not available
      });
    });
  }


  protected goBack(): void {
    this.router.navigate(['/training/library']);
  }

  protected onQuizComplete(passed: boolean): void {
    if (passed) this.completed.set(true);
  }

  protected printQuickRef(): void {
    window.print();
  }

  protected formatSeconds(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  protected learningStyleHint(): string {
    const type = this.module()?.contentType;
    if (!type) return '';
    const hints: Record<string, string> = {
      Article:     'Reading / Writing',
      Walkthrough: 'Visual / Kinesthetic',
      QuickRef:    'Visual / Reference',
      Quiz:        'Kinesthetic',
    };
    return hints[type] ?? '';
  }
}
