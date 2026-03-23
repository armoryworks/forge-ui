import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

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

type TrainingTab = 'library' | 'my-learning' | 'paths';

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') as TrainingTab) ?? 'library')),
    { initialValue: 'library' as TrainingTab },
  );

  protected readonly isLoading = signal(false);
  protected readonly modules = signal<TrainingModuleListItem[]>([]);
  protected readonly enrollments = signal<TrainingEnrollment[]>([]);
  protected readonly paths = signal<TrainingPath[]>([]);
  protected readonly totalCount = signal(0);

  protected readonly searchControl = new FormControl('');
  protected readonly contentTypeControl = new FormControl<string>('');

  protected readonly contentTypeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'Article', label: 'Article' },
    { value: 'Video', label: 'Video' },
    { value: 'Walkthrough', label: 'Walkthrough' },
    { value: 'QuickRef', label: 'Quick Reference' },
    { value: 'Quiz', label: 'Quiz / Assessment' },
  ];

  ngOnInit(): void {
    this.loadModules();
    this.loadEnrollments();
    this.loadPaths();

    this.searchControl.valueChanges.subscribe(() => this.loadModules());
    this.contentTypeControl.valueChanges.subscribe(() => this.loadModules());
  }

  protected switchTab(tab: TrainingTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  private loadModules(): void {
    this.isLoading.set(true);
    this.trainingService.getModules({
      search: this.searchControl.value ?? undefined,
      contentType: this.contentTypeControl.value ?? undefined,
      pageSize: 50,
    }).subscribe({
      next: result => {
        this.modules.set(result.data);
        this.totalCount.set(result.totalCount);
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
      Video: 'play_circle',
      Walkthrough: 'route',
      QuickRef: 'quick_reference_all',
      Quiz: 'quiz',
    };
    return icons[type] ?? 'school';
  }

  protected enrollmentProgress(e: TrainingEnrollment): number {
    if (e.totalModules === 0) return 0;
    return Math.round((e.completedModules / e.totalModules) * 100);
  }
}
