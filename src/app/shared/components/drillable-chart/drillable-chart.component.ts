import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, ChartType, ActiveElement, ChartEvent } from 'chart.js';

export interface DrillLevel {
  label: string;
  chartType: ChartType;
  data: ChartData;
  options?: ChartOptions;
}

export interface DrillEvent {
  level: number;
  index: number;
  label: string;
  datasetIndex: number;
}

@Component({
  selector: 'app-drillable-chart',
  standalone: true,
  imports: [BaseChartDirective],
  templateUrl: './drillable-chart.component.html',
  styleUrl: './drillable-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrillableChartComponent {
  readonly initialChartType = input.required<ChartType>();
  readonly initialData = input.required<ChartData>();
  readonly initialOptions = input<ChartOptions>();
  readonly initialLabel = input<string>('Overview');

  readonly drilled = output<DrillEvent>();
  readonly drillDataFn = input<(event: DrillEvent) => DrillLevel | null>();

  protected readonly drillStack = signal<DrillLevel[]>([]);

  protected readonly currentLevel = computed<DrillLevel>(() => {
    const stack = this.drillStack();
    if (stack.length > 0) return stack[stack.length - 1];
    return {
      label: this.initialLabel(),
      chartType: this.initialChartType(),
      data: this.initialData(),
      options: this.initialOptions(),
    };
  });

  protected readonly breadcrumbs = computed<string[]>(() => {
    const initial = this.initialLabel();
    const stack = this.drillStack();
    return [initial, ...stack.map(l => l.label)];
  });

  protected readonly canDrillUp = computed(() => this.drillStack().length > 0);

  protected readonly chartOptions = computed<ChartOptions>(() => {
    const base = this.currentLevel().options ?? {};
    return {
      ...base,
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
        this.onChartClick(elements);
      },
      onHover: (event: ChartEvent, elements: ActiveElement[]) => {
        const canvas = (event.native?.target as HTMLCanvasElement) ?? null;
        if (canvas) canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      },
    } as ChartOptions;
  });

  private onChartClick(elements: ActiveElement[]): void {
    if (elements.length === 0) return;

    const element = elements[0];
    const level = this.drillStack().length;
    const currentData = this.currentLevel().data;
    const label = (currentData.labels?.[element.index] as string) ?? '';

    const drillEvent: DrillEvent = {
      level,
      index: element.index,
      label,
      datasetIndex: element.datasetIndex,
    };

    this.drilled.emit(drillEvent);

    const fn = this.drillDataFn();
    if (fn) {
      const nextLevel = fn(drillEvent);
      if (nextLevel) {
        this.drillStack.update(stack => [...stack, nextLevel]);
      }
    }
  }

  protected navigateTo(breadcrumbIndex: number): void {
    if (breadcrumbIndex === 0) {
      this.drillStack.set([]);
    } else {
      this.drillStack.update(stack => stack.slice(0, breadcrumbIndex));
    }
  }

  drillUp(): void {
    this.drillStack.update(stack => stack.slice(0, -1));
  }

  reset(): void {
    this.drillStack.set([]);
  }
}
