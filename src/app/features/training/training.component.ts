import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

import { TrainingService } from './services/training.service';
import { TrainingModuleListItem } from './models/training-module.model';
import { TrainingEnrollment } from './models/training-progress.model';
import { TrainingPath } from './models/training-path.model';
import { TrainingContentType } from './models/training-content-type.enum';

type TrainingTab = 'my-learning' | 'paths' | 'all-modules';

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    InputComponent,
    SelectComponent,
    LoadingBlockDirective,
    EmptyStateComponent,
    PageLayoutComponent,
  ],
  templateUrl: './training.component.html',
  styleUrl: './training.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingComponent implements OnInit {
  private readonly trainingService = inject(TrainingService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') as TrainingTab) ?? 'my-learning')),
    { initialValue: 'my-learning' as TrainingTab },
  );

  protected readonly isLoading = signal(false);
  private readonly allModules = signal<TrainingModuleListItem[]>([]);
  protected readonly enrollments = signal<TrainingEnrollment[]>([]);
  protected readonly paths = signal<TrainingPath[]>([]);

  protected readonly searchControl = new FormControl('');
  protected readonly contentTypeControl = new FormControl<string>('');
  protected readonly learningStyleControl = new FormControl<string>('');

  protected readonly contentTypeOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('trainingPage.typeOptions.all') },
    { value: 'Article', label: this.translate.instant('trainingPage.typeOptions.article') },
    { value: 'Walkthrough', label: this.translate.instant('trainingPage.typeOptions.walkthrough') },
    { value: 'QuickRef', label: this.translate.instant('trainingPage.typeOptions.quickRef') },
    { value: 'Quiz', label: this.translate.instant('trainingPage.typeOptions.quiz') },
  ];

  protected readonly learningStyleOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('trainingPage.styleOptions.all') },
    { value: 'visual', label: this.translate.instant('trainingPage.styleOptions.visual') },
    { value: 'reading', label: this.translate.instant('trainingPage.styleOptions.reading') },
    { value: 'kinesthetic', label: this.translate.instant('trainingPage.styleOptions.handson') },
  ];

  private readonly searchValue = toSignal(this.searchControl.valueChanges, { initialValue: '' });
  private readonly contentTypeValue = toSignal(this.contentTypeControl.valueChanges, { initialValue: '' });
  private readonly learningStyleValue = toSignal(this.learningStyleControl.valueChanges, { initialValue: '' });

  private readonly styleTypeMap: Record<string, string[]> = {
    visual:       ['Walkthrough', 'QuickRef'],
    auditory:     [],
    reading:      ['Article', 'QuickRef'],
    kinesthetic:  ['Walkthrough', 'Quiz'],
  };

  protected readonly modules = computed(() => {
    const search = (this.searchValue() ?? '').toLowerCase();
    const type   = this.contentTypeValue() ?? '';
    const style  = this.learningStyleValue() ?? '';

    return this.allModules().filter(m => {
      if (search && !m.title.toLowerCase().includes(search) && !(m.summary ?? '').toLowerCase().includes(search)) return false;
      if (type && m.contentType !== type) return false;
      if (style && !this.styleTypeMap[style]?.includes(m.contentType)) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.loadModules();
    this.loadEnrollments();
    this.loadPaths();
  }

  protected switchTab(tab: TrainingTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  private loadModules(): void {
    this.isLoading.set(true);
    this.trainingService.getModules({ pageSize: 200 }).subscribe({
      next: result => {
        this.allModules.set(result.data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  private loadEnrollments(): void {
    this.trainingService.getMyEnrollments().subscribe({
      next: enrollments => this.enrollments.set(enrollments),
    });
  }

  private loadPaths(): void {
    this.trainingService.getPaths().subscribe({
      next: paths => this.paths.set(paths),
    });
  }

  protected openModule(module: TrainingModuleListItem): void {
    this.router.navigate(['/training/module', module.id]);
  }

  protected contentTypeIcon(type: TrainingContentType): string {
    const icons: Record<TrainingContentType, string> = {
      Article: 'article',
      Walkthrough: 'route',
      QuickRef: 'quick_reference_all',
      Quiz: 'quiz',
    };
    return icons[type] ?? 'school';
  }

  protected contentTypeLabel(type: TrainingContentType): string {
    const labels: Record<TrainingContentType, string> = {
      Article: this.translate.instant('trainingPage.typeOptions.article'),
      Walkthrough: this.translate.instant('trainingPage.typeOptions.walkthrough'),
      QuickRef: this.translate.instant('trainingPage.typeOptions.quickRef'),
      Quiz: this.translate.instant('trainingPage.typeOptions.quiz'),
    };
    return labels[type] ?? type;
  }

  protected learningStyleHint(type: TrainingContentType): string {
    const hints: Record<TrainingContentType, string> = {
      Article:     'Best for: Reading / Writing learners',
      Walkthrough: 'Best for: Visual / Kinesthetic learners',
      QuickRef:    'Best for: Visual / Reading learners',
      Quiz:        'Best for: Kinesthetic learners — learn by doing',
    };
    return hints[type] ?? '';
  }

  protected enrollmentProgress(e: TrainingEnrollment): number {
    if (e.totalModules === 0) return 0;
    return Math.round((e.completedModules / e.totalModules) * 100);
  }

  protected enrollmentForPath(pathId: number): TrainingEnrollment | null {
    return this.enrollments().find(e => e.pathId === pathId) ?? null;
  }

  protected pathDescriptionFor(pathId: number): string | null {
    return this.paths().find(p => p.id === pathId)?.description ?? null;
  }
}
