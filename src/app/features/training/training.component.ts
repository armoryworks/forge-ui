import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { TrainingTab } from './models/training-tab.model';
import { trainingContentIcon } from '../../shared/utils/training-content-icon';

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

  private readonly allLearningStyleOptions: SelectOption[] = [
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
    reading:      ['Article', 'QuickRef', 'Reference'],
    kinesthetic:  ['Walkthrough', 'Quiz'],
  };

  protected readonly learningStyleOptions = computed<SelectOption[]>(() => {
    const type = this.contentTypeValue() ?? '';
    return this.allLearningStyleOptions.filter(o =>
      !o.value || !type || (this.styleTypeMap[o.value as string] ?? []).includes(type));
  });

  protected readonly hasActiveFilters = computed(() =>
    !!this.searchValue() || !!this.contentTypeValue() || !!this.learningStyleValue());

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

  constructor() {
    this.contentTypeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(type => {
      const style = this.learningStyleControl.value;
      if (type && style && !(this.styleTypeMap[style] ?? []).includes(type)) {
        this.learningStyleControl.setValue('');
      }
    });
  }

  ngOnInit(): void {
    this.loadModules();
    this.loadEnrollments();
    this.loadPaths();
  }

  protected clearFilters(): void {
    this.searchControl.setValue('');
    this.contentTypeControl.setValue('');
    this.learningStyleControl.setValue('');
  }

  protected switchTab(tab: TrainingTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  private loadModules(): void {
    this.isLoading.set(true);
    this.trainingService.getAllModules().subscribe({
      next: modules => {
        this.allModules.set(modules);
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
    return trainingContentIcon(type);
  }

  protected contentTypeLabel(type: TrainingContentType): string {
    const labels: Record<TrainingContentType, string> = {
      Article: this.translate.instant('trainingPage.typeOptions.article'),
      Walkthrough: this.translate.instant('trainingPage.typeOptions.walkthrough'),
      QuickRef: this.translate.instant('trainingPage.typeOptions.quickRef'),
      Quiz: this.translate.instant('trainingPage.typeOptions.quiz'),
      Reference: this.translate.instant('trainingPage.typeOptions.reference'),
    };
    return labels[type] ?? type;
  }

  protected learningStyleHint(type: TrainingContentType): string {
    const hints: Record<TrainingContentType, string> = {
      Article:     'Best for: Reading / Writing learners',
      Walkthrough: 'Best for: Visual / Kinesthetic learners',
      QuickRef:    'Best for: Visual / Reading learners',
      Quiz:        'Best for: Kinesthetic learners — learn by doing',
      Reference:   'Best for: looking up advanced details and edge cases',
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
