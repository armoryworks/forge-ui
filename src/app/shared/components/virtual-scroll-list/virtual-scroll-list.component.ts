import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  input,
  TemplateRef,
} from '@angular/core';
import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-virtual-scroll-list',
  standalone: true,
  imports: [
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    NgTemplateOutlet,
  ],
  templateUrl: './virtual-scroll-list.component.html',
  styleUrl: './virtual-scroll-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VirtualScrollListComponent<T = unknown> {
  readonly items = input.required<T[]>();
  readonly itemSize = input(48);
  readonly trackByField = input('id');

  @ContentChild('itemTemplate') itemTemplate!: TemplateRef<{ $implicit: T }>;

  protected trackByFn = (_index: number, item: T): unknown => {
    return (item as Record<string, unknown>)[this.trackByField()];
  };
}
