import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Subject, debounceTime, filter, switchMap } from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';

import { SearchService } from '../../../../shared/services/search.service';
import { SearchResult } from '../../../../shared/models/search.model';

interface MentionGroup {
  type: string;
  label: string;
  icon: string;
  results: SearchResult[];
}

@Component({
  selector: 'app-entity-mention-popover',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './entity-mention-popover.component.html',
  styleUrl: './entity-mention-popover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityMentionPopoverComponent implements OnInit, OnDestroy {
  private readonly searchService = inject(SearchService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);

  readonly visible = input(false);
  readonly selected = output<{ entityType: string; entityId: number; displayText: string }>();
  readonly closed = output<void>();

  protected readonly results = signal<SearchResult[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly query = signal('');

  private readonly searchSubject = new Subject<string>();
  private documentClickHandler: ((e: MouseEvent) => void) | null = null;

  protected readonly groupedResults = computed<MentionGroup[]>(() => {
    const items = this.results();
    if (items.length === 0) return [];

    const groups = new Map<string, SearchResult[]>();
    for (const item of items) {
      const existing = groups.get(item.entityType) ?? [];
      existing.push(item);
      groups.set(item.entityType, existing);
    }

    return Array.from(groups.entries()).map(([type, groupResults]) => ({
      type,
      label: this.getTypeLabel(type),
      icon: groupResults[0]?.icon ?? 'search',
      results: groupResults,
    }));
  });

  protected readonly flatResults = computed<SearchResult[]>(() => {
    return this.groupedResults().flatMap(g => g.results);
  });

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      filter(q => q.length >= 2),
      switchMap(q => {
        this.isLoading.set(true);
        return this.searchService.search(q, 15);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.results.set(results);
      this.activeIndex.set(0);
      this.isLoading.set(false);
    });

    this.documentClickHandler = (e: MouseEvent) => {
      if (this.visible() && !this.elementRef.nativeElement.contains(e.target)) {
        this.closed.emit();
      }
    };
    document.addEventListener('click', this.documentClickHandler);
  }

  ngOnDestroy(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }
  }

  updateQuery(query: string): void {
    this.query.set(query);
    if (query.length < 2) {
      this.results.set([]);
      this.isLoading.set(false);
      return;
    }
    this.searchSubject.next(query);
  }

  onKeydown(event: KeyboardEvent): boolean {
    if (!this.visible()) return false;

    const flat = this.flatResults();
    if (flat.length === 0 && event.key !== 'Escape') return false;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(i => (i + 1) % flat.length);
        return true;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => (i - 1 + flat.length) % flat.length);
        return true;
      case 'Enter':
        event.preventDefault();
        this.selectResult(flat[this.activeIndex()]);
        return true;
      case 'Escape':
        event.preventDefault();
        this.closed.emit();
        return true;
      default:
        return false;
    }
  }

  selectResult(result: SearchResult): void {
    this.selected.emit({
      entityType: result.entityType,
      entityId: result.entityId,
      displayText: result.title,
    });
    this.results.set([]);
    this.query.set('');
  }

  protected isActive(result: SearchResult): boolean {
    const flat = this.flatResults();
    return flat[this.activeIndex()] === result;
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      job: 'Jobs',
      part: 'Parts',
      customer: 'Customers',
      vendor: 'Vendors',
      lead: 'Leads',
      asset: 'Assets',
      invoice: 'Invoices',
      quote: 'Quotes',
      'sales-order': 'Sales Orders',
      'purchase-order': 'Purchase Orders',
    };
    return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1) + 's';
  }
}
