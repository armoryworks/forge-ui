import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';

import { DashboardWidgetComponent } from '../../shared/components/dashboard-widget/dashboard-widget.component';
import { KpiChipComponent } from '../../shared/components/kpi-chip/kpi-chip.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ActivityWidgetComponent } from './components/activity-widget.component';
import { DeadlinesWidgetComponent } from './components/deadlines-widget.component';
import { JobsByStageWidgetComponent } from './components/jobs-by-stage-widget.component';
import { TeamLoadWidgetComponent } from './components/team-load-widget.component';
import { TodaysTasksWidgetComponent } from './components/todays-tasks-widget.component';
import { CycleProgressWidgetComponent } from './components/cycle-progress-widget.component';
import { OpenOrdersWidgetComponent } from './components/open-orders-widget.component';
import { EodPromptWidgetComponent } from './components/eod-prompt-widget.component';
import { MarginSummaryWidgetComponent } from './widgets/margin-summary-widget/margin-summary-widget.component';
import { AmbientModeComponent } from './components/ambient-mode.component';
import { GettingStartedBannerComponent } from './components/getting-started-banner.component';
import { DashboardData } from './models/dashboard-data.model';
import { DashboardWidgetConfig } from './models/dashboard-widget-config.model';
import { DashboardSavedLayout, DashboardWidgetLayout } from './models/dashboard-widget-layout.model';
import { WIDGET_REGISTRY } from './models/widget-registry';
import { DashboardService } from './services/dashboard.service';
import { LoadingService } from '../../shared/services/loading.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';

import type { GridStack, GridStackNode } from 'gridstack';

const LAYOUT_PREF_KEY = 'dashboard:layout:v5';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DashboardWidgetComponent,
    KpiChipComponent,
    TodaysTasksWidgetComponent,
    JobsByStageWidgetComponent,
    TeamLoadWidgetComponent,
    ActivityWidgetComponent,
    DeadlinesWidgetComponent,
    CycleProgressWidgetComponent,
    OpenOrdersWidgetComponent,
    EodPromptWidgetComponent,
    MarginSummaryWidgetComponent,
    AmbientModeComponent,
    GettingStartedBannerComponent,
    PageHeaderComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly loadingService = inject(LoadingService);
  private readonly userPreferences = inject(UserPreferencesService);
  private readonly ngZone = inject(NgZone);

  private grid: GridStack | null = null;
  private readonly gridContainer = viewChild<ElementRef<HTMLElement>>('gridContainer');
  private resizeObserver: ResizeObserver | null = null;

  protected readonly data = signal<DashboardData | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly ambientMode = signal(false);
  protected readonly editing = signal(false);
  protected readonly gridReady = signal(false);

  protected readonly activeWidgetIds = signal<string[]>(
    WIDGET_REGISTRY.map(w => w.id)
  );

  protected readonly activeWidgets = computed(() => {
    const ids = this.activeWidgetIds();
    return WIDGET_REGISTRY.filter(w => ids.includes(w.id));
  });

  protected readonly availableWidgets = computed(() => {
    const ids = this.activeWidgetIds();
    return WIDGET_REGISTRY.filter(w => !ids.includes(w.id));
  });

  protected readonly showAddMenu = signal(false);

  constructor() {
    // Init GridStack when the container appears (after data loads and @if renders)
    effect(() => {
      const container = this.gridContainer()?.nativeElement;
      if (container && !this.grid) {
        this.initGrid(container);
      }
    });
  }

  ngOnInit(): void {
    this.loadingService.track('Loading dashboard...', this.dashboardService.getDashboard())
      .subscribe({
        next: (data) => this.data.set(data),
        error: () => this.error.set('Failed to load dashboard data'),
      });
  }

  private async initGrid(container: HTMLElement): Promise<void> {
    const { GridStack } = await import('gridstack');

    const columns = this.getResponsiveColumns(container.clientWidth);

    this.grid = GridStack.init({
      column: columns,
      cellHeight: 60,
      margin: 4,
      animate: true,
      float: false,
      disableDrag: true,
      disableResize: true,
    }, container);

    this.loadSavedLayout();

    this.grid.on('change', (_event: Event, nodes: GridStackNode[]) => {
      if (nodes && this.editing()) {
        this.saveLayout();
      }
    });

    // Responsive column switching via ResizeObserver
    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (this.grid) {
        const newCols = this.getResponsiveColumns(width);
        if (this.grid.getColumn() !== newCols) {
          this.ngZone.run(() => {
            this.grid!.column(newCols);
          });
        }
      }
    });
    this.resizeObserver.observe(container);

    this.gridReady.set(true);
  }

  private getResponsiveColumns(width: number): number {
    if (width < 768) return 1;
    if (width < 1024) return 6;
    return 12;
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.grid) {
      this.grid.destroy(false);
      this.grid = null;
    }
  }

  protected toggleEditing(): void {
    const next = !this.editing();
    this.editing.set(next);

    if (this.grid) {
      this.grid.enableMove(next);
      this.grid.enableResize(next);
    }

    if (!next) {
      this.showAddMenu.set(false);
      this.saveLayout();
    }
  }

  protected toggleAddMenu(): void {
    this.showAddMenu.update(v => !v);
  }

  protected addWidget(config: DashboardWidgetConfig): void {
    this.activeWidgetIds.update(ids => [...ids, config.id]);
    this.showAddMenu.set(false);

    // Allow DOM to update, then add the widget to grid
    requestAnimationFrame(() => {
      if (this.grid) {
        const el = this.gridContainer()?.nativeElement
          .querySelector(`[gs-id="${config.id}"]`) as HTMLElement;
        if (el) {
          this.grid.makeWidget(el);
        }
        this.saveLayout();
      }
    });
  }

  protected removeWidget(widgetId: string): void {
    if (this.grid) {
      const el = this.gridContainer()?.nativeElement
        .querySelector(`[gs-id="${widgetId}"]`) as HTMLElement;
      if (el) {
        this.grid.removeWidget(el, false);
      }
    }
    this.activeWidgetIds.update(ids => ids.filter(id => id !== widgetId));
    this.saveLayout();
  }

  protected resetLayout(): void {
    this.activeWidgetIds.set(WIDGET_REGISTRY.map(w => w.id));
    this.userPreferences.remove(LAYOUT_PREF_KEY);

    // Destroy and reinitialize grid with defaults
    requestAnimationFrame(async () => {
      if (this.grid) {
        this.grid.destroy(false);
      }

      const { GridStack } = await import('gridstack');
      const container = this.gridContainer()?.nativeElement;
      if (!container) return;

      const columns = this.getResponsiveColumns(container.clientWidth);
      this.grid = GridStack.init({
        column: columns,
        cellHeight: 60,
        margin: 4,
        animate: true,
        float: false,
        disableDrag: !this.editing(),
        disableResize: !this.editing(),
      }, container);

      this.grid.on('change', (_event: Event, nodes: GridStackNode[]) => {
        if (nodes && this.editing()) {
          this.saveLayout();
        }
      });
    });
  }

  protected getWidgetConfig(widgetId: string): DashboardWidgetConfig | undefined {
    return WIDGET_REGISTRY.find(w => w.id === widgetId);
  }

  protected exportDashboard(): void {
    const d = this.data();
    if (!d) return;

    const lines: string[] = [];
    lines.push('Section,Field,Value');
    lines.push(`KPIs,Active Jobs,${d.kpis.activeCount}`);
    lines.push(`KPIs,Overdue Jobs,${d.kpis.overdueCount}`);
    lines.push(`KPIs,Total Hours,${d.kpis.totalHours}`);
    lines.push('');
    lines.push('Stage,Count');
    for (const s of d.stages) {
      lines.push(`${s.label},${s.count}`);
    }
    lines.push('');
    lines.push('Team Member,Task Count');
    for (const t of d.team) {
      lines.push(`${t.name},${t.taskCount}`);
    }
    lines.push('');
    lines.push('Deadline,Job #,Title,Overdue');
    for (const dl of d.deadlines) {
      lines.push(`${dl.date},${dl.jobNumber},"${dl.description}",${dl.isOverdue}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private loadSavedLayout(): void {
    const saved = this.userPreferences.get<DashboardSavedLayout>(LAYOUT_PREF_KEY);
    if (!saved?.widgets?.length || !this.grid) return;

    const savedIds = saved.widgets.map(w => w.id);
    this.activeWidgetIds.set(savedIds);

    // Apply saved positions after DOM settles
    requestAnimationFrame(() => {
      if (!this.grid) return;
      for (const widget of saved.widgets) {
        const el = this.gridContainer()?.nativeElement
          .querySelector(`[gs-id="${widget.id}"]`) as HTMLElement;
        if (el) {
          this.grid.update(el, {
            x: widget.x,
            y: widget.y,
            w: widget.w,
            h: widget.h,
          });
        }
      }
    });
  }

  private saveLayout(): void {
    if (!this.grid) return;

    const nodes = this.grid.getGridItems();
    const widgets: DashboardWidgetLayout[] = [];

    for (const el of nodes) {
      const id = el.getAttribute('gs-id');
      const node = el.gridstackNode;
      if (id && node) {
        widgets.push({
          id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          w: node.w ?? 4,
          h: node.h ?? 3,
        });
      }
    }

    const layout: DashboardSavedLayout = { widgets };
    this.userPreferences.set(LAYOUT_PREF_KEY, layout);
  }
}
