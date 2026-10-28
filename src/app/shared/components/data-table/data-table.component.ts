import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DEFAULT_CURRENCY_CODE,
  contentChild,
  contentChildren,
  DestroyRef,
  effect,
  inject,
  input,
  LOCALE_ID,
  OnInit,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
ElementRef, } from '@angular/core';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OverlayModule } from '@angular/cdk/overlay';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import writeXlsxFile, { type CellObject, type SheetData } from 'write-excel-file/browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ColumnDef } from '../../models/column-def.model';
import { SortState } from '../../models/sort-state.model';
import { ServerPageRequest, ServerPageState } from '../../models/server-page-state.model';
import { TablePreferences } from '../../models/table-preferences.model';
import { ColumnCellDirective } from '../../directives/column-cell.directive';
import { RowExpandDirective } from '../../directives/row-expand.directive';
import { LoadingBlockDirective } from '../../directives/loading-block.directive';
import { ScrollCueDirective } from '../../directives/scroll-cue.directive';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ColumnFilterPopoverComponent, ColumnFilterState } from './column-filter-popover/column-filter-popover.component';
import { ColumnManagerPanelComponent, ColumnManagerState } from './column-manager-panel/column-manager-panel.component';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { DisplayLabelService } from '../../services/display-label.service';
import { formatDate, formatDateTime, parseDateOnly, toCalendarDate } from '../../utils/date.utils';
import { foldText } from '../../utils/text-fold';
import { downloadCsv } from '../../utils/download-csv';

const PHONE_QUERY = '(max-width: 767.98px)';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MatCheckboxModule,
    MatDividerModule,
    MatMenuModule,
    MatPaginatorModule,
    MatTooltipModule,
    OverlayModule,
    LoadingBlockDirective,
    ScrollCueDirective,
    EmptyStateComponent,
    ColumnFilterPopoverComponent,
    ColumnManagerPanelComponent,
    TranslatePipe,
  ],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent implements OnInit {
  private readonly prefs = inject(UserPreferencesService);
  private readonly labels = inject(DisplayLabelService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly translate = inject(TranslateService);
  private readonly money = new CurrencyPipe(inject(LOCALE_ID), inject(DEFAULT_CURRENCY_CODE));
  private readonly isPhone = toSignal(
    inject(BreakpointObserver).observe(PHONE_QUERY).pipe(map(state => state.matches)),
    { initialValue: false },
  );

  readonly tableId = input.required<string>();
  readonly columns = input.required<ColumnDef[]>();
  readonly data = input.required<unknown[]>();
  readonly selectable = input(false);
  readonly trackByField = input('id');
  readonly emptyIcon = input('search_off');
  readonly emptyMessage = input('common.noResults');
  readonly emptyHelpText = input<string>();
  readonly expandable = input(false);
  readonly loading = input(false);
  readonly stickyFirstColumn = input(false);
  readonly clickableRows = input(false);
  readonly rowClass = input<((row: unknown) => string) | null>(null);
  readonly rowStyle = input<((row: unknown) => Record<string, string>) | null>(null);
  /**
   * Optional predicate for rows that should always render at the top of the
   * table, ignoring the user's sort. Use for "drafts" / "pending" / "starred"
   * affordances where in-progress items should stay in the user's scan path
   * regardless of the active sort column. Returns true → row pins to top.
   */
  readonly pinPredicate = input<((row: unknown) => boolean) | null>(null);
  /** Base file name, without extension, for the CSV and Excel exports. Defaults to `<tableId>-export`. */
  readonly exportFileName = input<string | null>(null);
  /**
   * Server-paged mode. When set, `data` is one server page: the paginator
   * runs off `totalCount`, sorting is a single column sent back through
   * {@link serverPageChange}, column filters are hidden unless the state is
   * `filterable` (then they travel back with each request), and export covers
   * the rows on this page. Columns marked `serverSortable: false` or
   * `serverFilterable: false` lose that action here. The consumer owns the
   * state and fetches the page it asks for. Leave null for client-side paging
   * over `data`.
   */
  readonly serverPaging = input<ServerPageState | null>(null);

  readonly rowClick = output<unknown>();
  readonly selectionChange = output<unknown[]>();
  /** The page or sort the user asked for in server-paged mode. */
  readonly serverPageChange = output<ServerPageRequest>();

  readonly cellTemplates = contentChildren(ColumnCellDirective);
  readonly expandTemplate = contentChild(RowExpandDirective);

  protected readonly sortStates = signal<SortState[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);
  protected readonly selectedRows = signal<Set<unknown>>(new Set());
  protected readonly columnVisibility = signal<Record<string, boolean>>({});
  protected readonly columnOrder = signal<string[]>([]);
  protected readonly columnWidths = signal<Record<string, string>>({});
  protected readonly filters = signal<Record<string, unknown>>({});

  protected readonly filterOpenField = signal<string | null>(null);
  protected readonly columnManagerOpen = signal(false);
  protected readonly contextMenuPosition = signal({ x: 0, y: 0 });
  protected readonly contextMenuCol = signal<ColumnDef | null>(null);
  protected readonly contextMenuTrigger = viewChild<MatMenuTrigger>('contextMenuTrigger');
  protected resizingField: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly orderedColumns = computed(() => {
    const cols = this.columns();
    const order = this.columnOrder();
    if (!order.length) return cols;

    const colMap = new Map(cols.map(c => [c.field, c]));
    const ordered: ColumnDef[] = [];
    for (const field of order) {
      const col = colMap.get(field);
      if (col) ordered.push(col);
    }
    // Append any new columns not in saved order
    for (const col of cols) {
      if (!order.includes(col.field)) ordered.push(col);
    }
    return ordered;
  });

  protected readonly defaultVisibility = computed(() => {
    const phone = this.isPhone();
    const defaults: Record<string, boolean> = {};
    for (const col of this.columns()) {
      defaults[col.field] = col.visible !== false && !(phone && col.phoneHidden);
    }
    return defaults;
  });

  protected readonly visibleColumns = computed(() => {
    const vis = this.columnVisibility();
    const defaults = this.defaultVisibility();
    return this.orderedColumns().filter(col => {
      if (col.field in vis) return vis[col.field];
      return defaults[col.field];
    });
  });

  protected readonly isServerPaged = computed(() => this.serverPaging() !== null);

  protected readonly isServerFilterable = computed(() => this.serverPaging()?.filterable === true);

  /** The column filters in effect: in server-paged mode, only those the server applies. */
  readonly activeFilters = computed<Record<string, unknown>>(() => {
    const all = this.filters();
    if (!this.isServerPaged()) return all;
    if (!this.isServerFilterable()) return {};
    const allowed = new Set(this.columns().filter(c => c.serverFilterable !== false).map(c => c.field));
    return Object.fromEntries(Object.entries(all).filter(([field]) => allowed.has(field)));
  });

  protected readonly paginatorLength = computed(() =>
    this.serverPaging()?.totalCount ?? this.sortedData().length,
  );

  protected readonly paginatorPageIndex = computed(() =>
    this.serverPaging()?.pageIndex ?? this.effectivePageIndex(),
  );

  protected readonly paginatorPageSize = computed(() =>
    this.serverPaging()?.pageSize ?? this.pageSize(),
  );

  protected readonly filteredData = computed(() => {
    const data = this.data();
    if (this.isServerPaged()) return data;
    const activeFilters = this.filters();
    const filterKeys = Object.keys(activeFilters);
    if (!filterKeys.length) return data;

    return data.filter(row => {
      const rec = row as Record<string, unknown>;
      return filterKeys.every(field => {
        const filterVal = activeFilters[field];
        if (filterVal == null) return true;

        const col = this.columns().find(c => c.field === field);
        const cellVal = rec[field];
        const type = col?.type ?? 'text';

        switch (type) {
          case 'text': {
            // filterVal can be a plain string (legacy "contains") or
            // { mode, value } from the new match-mode picker. Back-compat
            // treats a bare string as contains.
            const cell = foldText(cellVal);
            let needle: string;
            let mode: string;
            if (typeof filterVal === 'string') {
              needle = foldText(filterVal);
              mode = 'contains';
            } else {
              const tv = filterVal as { mode?: string; value?: string };
              needle = foldText(tv.value);
              mode = tv.mode ?? 'contains';
            }
            if (!needle) return true;
            switch (mode) {
              case 'equals': return cell === needle;
              case 'startsWith': return cell.startsWith(needle);
              case 'endsWith': return cell.endsWith(needle);
              case 'notContains': return !cell.includes(needle);
              case 'notEquals': return cell !== needle;
              case 'contains':
              default: return cell.includes(needle);
            }
          }
          case 'number':
          case 'currency': {
            const range = filterVal as { min?: number; max?: number };
            const num = Number(cellVal);
            if (range.min != null && num < range.min) return false;
            if (range.max != null && num > range.max) return false;
            return true;
          }
          case 'date': {
            const range = filterVal as { from?: Date; to?: Date };
            const date = cellVal ? parseDateOnly(String(cellVal)) ?? new Date(cellVal as string) : null;
            if (!date) return false;
            if (range.from && date < range.from) return false;
            if (range.to && date > range.to) return false;
            return true;
          }
          case 'enum': {
            const allowed = filterVal as unknown[];
            return allowed.includes(cellVal);
          }
          default:
            return true;
        }
      });
    });
  });

  protected readonly sortedData = computed(() => {
    const allData = [...this.filteredData()];
    const sorts = this.isServerPaged() ? [] : this.sortStates();
    const pin = this.pinPredicate();

    // Partition pinned rows out so they always render at the top regardless
    // of the active sort. Pinned rows preserve their incoming order; the
    // un-pinned rows go through the normal sort below.
    const pinned: unknown[] = [];
    const data: unknown[] = [];
    if (pin) {
      for (const row of allData) (pin(row) ? pinned : data).push(row);
    } else {
      data.push(...allData);
    }

    if (!sorts.length) return [...pinned, ...data];

    const columns = this.columns();
    const resolvers = new Map<string, (row: unknown) => unknown>();
    const types = new Map<string, ColumnDef['type']>();
    for (const sort of sorts) {
      const col = columns.find(c => c.field === sort.field);
      types.set(sort.field, col?.type);
      if (col?.sortValue) {
        resolvers.set(sort.field, col.sortValue);
      } else if (col?.sortField) {
        const key = col.sortField;
        resolvers.set(sort.field, row => (row as Record<string, unknown>)[key]);
      } else {
        resolvers.set(sort.field, row => (row as Record<string, unknown>)[sort.field]);
      }
    }

    const sorted = data.sort((a, b) => {
      for (const sort of sorts) {
        const resolve = resolvers.get(sort.field)!;
        const valA = resolve(a);
        const valB = resolve(b);

        const blankA = isBlankSortValue(valA);
        const blankB = isBlankSortValue(valB);
        if (blankA || blankB) {
          if (blankA && blankB) continue;
          return blankA ? 1 : -1;
        }

        const comparison = compareSortValues(valA, valB, types.get(sort.field));
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });

    return [...pinned, ...sorted];
  });

  protected readonly effectivePageIndex = computed(() => {
    const lastPage = Math.max(0, Math.ceil(this.sortedData().length / this.pageSize()) - 1);
    return Math.min(this.pageIndex(), lastPage);
  });

  protected readonly pagedData = computed(() => {
    const all = this.sortedData();
    if (this.isServerPaged()) return all;
    const start = this.effectivePageIndex() * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  protected readonly allMatchingSelected = computed(() => {
    const data = this.sortedData();
    if (!data.length) return false;
    const selected = this.selectedRows();
    return data.every(row => selected.has(this.getTrackValue(row)));
  });

  protected readonly showSelectAllMatching = computed(() =>
    this.selectable() && this.allSelected() && this.sortedData().length > this.pagedData().length
  );

  protected readonly allSelected = computed(() => {
    const data = this.pagedData();
    if (!data.length) return false;
    const selected = this.selectedRows();
    return data.every(row => selected.has(this.getTrackValue(row)));
  });

  protected readonly someSelected = computed(() => {
    const data = this.pagedData();
    const selected = this.selectedRows();
    const count = data.filter(row => selected.has(this.getTrackValue(row))).length;
    return count > 0 && count < data.length;
  });

  protected readonly activeFilterCount = computed(() =>
    Object.keys(this.activeFilters()).length
  );

  protected readonly expandedRows = signal<Set<unknown>>(new Set());

  protected readonly stickyLeftOffset = computed(() => {
    let offset = 0;
    if (this.expandable()) offset += 32;
    if (this.selectable()) offset += 40;
    return offset;
  });

  protected readonly totalColSpan = computed(() => {
    let count = this.visibleColumns().length + 1; // +1 for gear column
    if (this.selectable()) count++;
    if (this.expandable()) count++;
    return count;
  });

  constructor() {
    effect(() => {
      const clamped = this.effectivePageIndex();
      if (untracked(this.pageIndex) !== clamped) this.pageIndex.set(clamped);
    });
    effect(() => {
      this.data();
      untracked(() => this.pruneSelectionToFiltered());
    });
  }

  ngOnInit(): void {
    this.loadPreferences();
  }

  getCellTemplate(field: string): TemplateRef<unknown> | null {
    const directive = this.cellTemplates().find(d => d.field() === field);
    return directive?.template ?? null;
  }

  getRowClasses(row: unknown): string {
    const fn = this.rowClass();
    return fn ? fn(row) : '';
  }

  getRowStyles(row: unknown): Record<string, string> {
    const fn = this.rowStyle();
    return fn ? fn(row) : {};
  }

  formatCellValue(row: unknown, col: ColumnDef): unknown {
    const val = (row as Record<string, unknown>)[col.field];
    if (col.type === 'date' && val) {
      const dateOnly = typeof val === 'string' ? parseDateOnly(val) : isUtcMidnight(val) ? toCalendarDate(val as Date) : null;
      if (dateOnly) {
        return formatDate(dateOnly);
      }
      return formatDateTime(val as string | Date);
    }
    if (typeof val === 'boolean') {
      return this.labels.booleanLabel(val);
    }
    if (col.type === 'currency' && val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val))) {
      return this.money.transform(Number(val));
    }
    if (col.type === 'enum' && typeof val === 'string' && val !== '') {
      return col.filterOptions?.find(o => o.value === val)?.label ?? this.labels.enumLabel(val);
    }
    return val;
  }

  getColumnWidth(col: ColumnDef): string | null {
    return this.columnWidths()[col.field] ?? col.width ?? null;
  }

  getSortState(field: string): SortState | undefined {
    const server = this.serverPaging();
    if (server) {
      const col = this.columns().find(c => c.field === field);
      const key = col?.sortField ?? field;
      return server.sort === key ? { field, direction: server.order } : undefined;
    }
    return this.sortStates().find(s => s.field === field);
  }

  hasFilter(field: string): boolean {
    return field in this.activeFilters();
  }

  isColumnSortable(col: ColumnDef): boolean {
    return !!col.sortable && (!this.isServerPaged() || col.serverSortable !== false);
  }

  isColumnFilterable(col: ColumnDef): boolean {
    if (col.filterable === false) return false;
    return !this.isServerPaged() || (this.isServerFilterable() && col.serverFilterable !== false);
  }

  /**
   * The request that reproduces this table's own sort, filters and page size against the
   * server, from the first page. For a consumer that switches to server-paged mode and
   * must fetch its first page before the table has asked for one.
   */
  serverRequest(): ServerPageRequest {
    const sort = this.sortStates().find(s => {
      const col = this.columns().find(c => c.field === s.field);
      return !!col?.sortable && col.serverSortable !== false;
    });
    const col = sort ? this.columns().find(c => c.field === sort.field) : undefined;
    return {
      pageIndex: 0,
      pageSize: this.pageSize(),
      sort: col ? col.sortField ?? col.field : null,
      order: sort?.direction ?? 'asc',
      filters: this.serverFilterValues(),
    };
  }

  onHeaderClick(col: ColumnDef, event: MouseEvent): void {
    if (!this.isColumnSortable(col)) return;
    if (this.isServerPaged()) {
      const existing = this.getSortState(col.field);
      if (!existing) this.requestServerSort(col, 'asc');
      else if (existing.direction === 'asc') this.requestServerSort(col, 'desc');
      else this.requestServerSort(null, 'asc');
      return;
    }

    const current = this.sortStates();
    const existing = current.find(s => s.field === col.field);

    if (event.shiftKey) {
      if (existing) {
        if (existing.direction === 'asc') {
          this.sortStates.set(
            current.map(s => s.field === col.field ? { ...s, direction: 'desc' as const } : s)
          );
        } else {
          this.sortStates.set(current.filter(s => s.field !== col.field));
        }
      } else {
        this.sortStates.set([...current, { field: col.field, direction: 'asc' }]);
      }
    } else {
      if (existing) {
        if (existing.direction === 'asc') {
          this.sortStates.set([{ field: col.field, direction: 'desc' }]);
        } else {
          this.sortStates.set([]);
        }
      } else {
        this.sortStates.set([{ field: col.field, direction: 'asc' }]);
      }
    }
    this.debouncedSave();
  }

  onPageChange(event: PageEvent): void {
    const server = this.serverPaging();
    if (server) {
      this.pageSize.set(event.pageSize);
      this.serverPageChange.emit({
        pageIndex: event.pageSize === server.pageSize ? event.pageIndex : 0,
        pageSize: event.pageSize,
        sort: server.sort,
        order: server.order,
        ...this.serverFiltersPart(),
      });
      this.debouncedSave();
      return;
    }
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.debouncedSave();
  }

  onRowClick(row: unknown, event?: MouseEvent): void {
    if ((event?.detail ?? 0) > 1) return;
    this.rowClick.emit(row);
  }

  onRowKeydown(row: unknown, event: KeyboardEvent): void {
    if (!this.clickableRows() || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onRowClick(row);
    }
  }

  getAriaSort(col: ColumnDef): 'ascending' | 'descending' | 'none' | null {
    if (!this.isColumnSortable(col)) return null;
    const sort = this.getSortState(col.field);
    if (!sort) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  toggleSelectAll(): void {
    const data = this.pagedData();
    const selected = new Set(this.selectedRows());

    if (this.allSelected()) {
      data.forEach(row => selected.delete(this.getTrackValue(row)));
    } else {
      data.forEach(row => selected.add(this.getTrackValue(row)));
    }

    this.selectedRows.set(selected);
    this.selectionChange.emit(this.getSelectedData());
  }

  selectAllMatching(): void {
    const selected = new Set(this.selectedRows());
    this.sortedData().forEach(row => selected.add(this.getTrackValue(row)));
    this.selectedRows.set(selected);
    this.selectionChange.emit(this.getSelectedData());
  }

  clearSelection(): void {
    this.selectedRows.set(new Set());
    this.selectionChange.emit([]);
  }

  toggleRowSelection(row: unknown, event: Event): void {
    event.stopPropagation();
    const key = this.getTrackValue(row);
    const selected = new Set(this.selectedRows());

    if (selected.has(key)) {
      selected.delete(key);
    } else {
      selected.add(key);
    }

    this.selectedRows.set(selected);
    this.selectionChange.emit(this.getSelectedData());
  }

  isRowSelected(row: unknown): boolean {
    return this.selectedRows().has(this.getTrackValue(row));
  }

  trackByFn(_index: number, row: unknown): unknown {
    return this.getTrackValue(row);
  }

  /**
   * Find-in-context (ACCOUNTING_SUITE_PLAN §5A.1, generalized): page to, center, and flash a row
   * WITHOUT filtering its peers away. The row is located in the current sorted order (so it works
   * with any active column sort), the internal paginator jumps to its page, and after render the
   * row scrolls into view with a transient highlight.
   */
  scrollToRow(row: unknown): void {
    const key = this.getTrackValue(row);
    const index = this.sortedData().findIndex(r => this.getTrackValue(r) === key);
    if (index < 0) return;
    if (!this.isServerPaged()) this.pageIndex.set(Math.floor(index / this.pageSize()));
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector(`tr[data-row-key="${String(key)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('data-table__row--located');
      setTimeout(() => el.classList.remove('data-table__row--located'), 1600);
    }, 50);
  }

  // ─── Expandable Rows ───
  toggleRowExpand(row: unknown, event?: Event): void {
    event?.stopPropagation();
    const key = this.getTrackValue(row);
    const expanded = new Set(this.expandedRows());
    if (expanded.has(key)) {
      expanded.delete(key);
    } else {
      expanded.add(key);
    }
    this.expandedRows.set(expanded);
  }

  isRowExpanded(row: unknown): boolean {
    return this.expandedRows().has(this.getTrackValue(row));
  }

  // ─── CSV Export ───
  exportCsv(): void {
    const cols = this.exportColumns();
    const header = cols.map(col => this.exportHeader(col));
    const data = this.sortedData().map(row => cols.map(col => this.exportText(row, col)));
    downloadCsv([header, ...data], this.exportBaseName());
  }

  // ─── Excel Export ───
  exportExcel(): void {
    const cols = this.exportColumns();
    const header: CellObject[] = cols.map(col => ({ value: this.exportHeader(col), fontWeight: 'bold' }));
    const body = this.sortedData().map(row => cols.map(col => this.toExcelCell(row, col)));
    const data: SheetData = [header, ...body];
    void writeXlsxFile(data).toFile(`${this.exportBaseName()}.xlsx`);
  }

  private static readonly DECORATIVE_FIELDS = new Set(['actions', 'icon', 'avatar', 'color']);
  private static readonly EXPORT_STRIP_SELECTOR =
    'mat-icon, .material-icons, .material-icons-outlined, .material-icons-round, .material-icons-sharp, .material-symbols-outlined, '
    + '[aria-hidden="true"], button, .sr-only, .cdk-visually-hidden';

  private exportBaseName(): string {
    return this.exportFileName() || `${this.tableId()}-export`;
  }

  private exportColumns(): ColumnDef[] {
    return this.visibleColumns().filter(col =>
      col.exportable !== false && !DataTableComponent.DECORATIVE_FIELDS.has(col.field));
  }

  private exportHeader(col: ColumnDef): string {
    return col.header?.trim() ? this.translate.instant(col.header) : col.field;
  }

  private exportText(row: unknown, col: ColumnDef): string {
    if (col.exportValue) {
      return this.plainText(col.exportValue(row), col);
    }
    const tmpl = this.getCellTemplate(col.field);
    if (tmpl) {
      const rendered = this.renderTemplateText(tmpl, row);
      if (rendered) return rendered;
    }
    return this.plainText((row as Record<string, unknown>)[col.field], col);
  }

  private plainText(raw: unknown, col: ColumnDef): string {
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'boolean') {
      return this.translate.instant(raw ? 'common.yes' : 'common.no');
    }
    if (col.type === 'enum' && col.filterOptions?.length) {
      const option = col.filterOptions.find(o => o.value === raw);
      if (option) return option.label;
    }
    const formatted = this.formatCellValue({ [col.field]: raw }, col);
    return formatted === null || formatted === undefined ? '' : String(formatted);
  }

  private renderTemplateText(tmpl: TemplateRef<unknown>, row: unknown): string {
    const view = tmpl.createEmbeddedView({ $implicit: row });
    try {
      view.detectChanges();
      const holder = document.createElement('div');
      for (const node of view.rootNodes as Node[]) {
        holder.appendChild(node.cloneNode(true));
      }
      holder.querySelectorAll(DataTableComponent.EXPORT_STRIP_SELECTOR).forEach(el => el.remove());
      return (holder.textContent ?? '').replace(/\s+/g, ' ').trim();
    } finally {
      view.destroy();
    }
  }

  private toExcelCell(row: unknown, col: ColumnDef): CellObject | null {
    const raw = (row as Record<string, unknown>)[col.field];
    if (!col.exportValue && raw !== null && raw !== undefined && raw !== '' && typeof raw !== 'boolean') {
      if (col.type === 'number' || col.type === 'currency') {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isNaN(n)) return col.type === 'currency' ? { type: Number, value: n, format: '#,##0.00' } : { type: Number, value: n };
      }
      if (col.type === 'date') {
        const d = raw instanceof Date ? raw : parseDateOnly(String(raw)) ?? new Date(raw as string);
        if (!Number.isNaN(d.getTime())) return { type: Date, value: d, format: 'mm/dd/yyyy' };
      }
    }
    const text = this.exportText(row, col);
    return text === '' ? null : { type: String, value: text };
  }

  // ─── Filter ───
  openFilter(field: string, event: Event): void {
    event.stopPropagation();
    this.filterOpenField.set(this.filterOpenField() === field ? null : field);
  }

  onFilterApplied(state: ColumnFilterState): void {
    const current = { ...this.filters() };
    current[state.field] = state.value;
    this.filters.set(current);
    this.pageIndex.set(0);
    this.pruneSelectionToFiltered();
    this.debouncedSave();
    this.requestServerFilters();
  }

  onFilterCleared(field: string): void {
    const current = { ...this.filters() };
    delete current[field];
    this.filters.set(current);
    this.pageIndex.set(0);
    this.pruneSelectionToFiltered();
    this.debouncedSave();
    this.requestServerFilters();
  }

  closeFilter(): void {
    this.filterOpenField.set(null);
  }

  // ─── Column Manager ───
  toggleColumnManager(event: Event): void {
    event.stopPropagation();
    this.columnManagerOpen.update(v => !v);
  }

  onColumnManagerChange(state: ColumnManagerState): void {
    this.columnVisibility.set(state.visibility);
    this.columnOrder.set(state.order);
    this.debouncedSave();
  }

  onColumnManagerReset(): void {
    this.columnVisibility.set({});
    this.columnOrder.set(this.columns().map(c => c.field));
    this.columnWidths.set({});
    this.sortStates.set([]);
    this.filters.set({});
    this.pageSize.set(25);
    this.pageIndex.set(0);
    this.prefs.reset(`table:${this.tableId()}`);
  }

  closeColumnManager(): void {
    this.columnManagerOpen.set(false);
  }

  // ─── Context Menu ───
  onHeaderContextMenu(col: ColumnDef, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.contextMenuCol.set(col);
    this.contextMenuTrigger()?.openMenu();
  }

  contextSortAsc(): void {
    const col = this.contextMenuCol();
    if (!col) return;
    if (this.isServerPaged()) {
      this.requestServerSort(col, 'asc');
      return;
    }
    this.sortStates.set([{ field: col.field, direction: 'asc' }]);
    this.debouncedSave();
  }

  contextSortDesc(): void {
    const col = this.contextMenuCol();
    if (!col) return;
    if (this.isServerPaged()) {
      this.requestServerSort(col, 'desc');
      return;
    }
    this.sortStates.set([{ field: col.field, direction: 'desc' }]);
    this.debouncedSave();
  }

  contextClearSort(): void {
    const col = this.contextMenuCol();
    if (!col) return;
    if (this.isServerPaged()) {
      this.requestServerSort(null, 'asc');
      return;
    }
    this.sortStates.update(sorts => sorts.filter(s => s.field !== col.field));
    this.debouncedSave();
  }

  contextFilter(): void {
    const col = this.contextMenuCol();
    if (!col) return;
    this.filterOpenField.set(col.field);
  }

  contextClearFilter(): void {
    const col = this.contextMenuCol();
    if (!col) return;
    this.onFilterCleared(col.field);
  }

  contextClearAllFilters(): void {
    this.filters.set({});
    this.pageIndex.set(0);
    this.pruneSelectionToFiltered();
    this.debouncedSave();
    this.requestServerFilters();
  }

  contextHideColumn(): void {
    const col = this.contextMenuCol();
    if (!col) return;
    const vis = { ...this.columnVisibility() };
    vis[col.field] = false;
    this.columnVisibility.set(vis);
    this.debouncedSave();
  }

  contextResetWidth(): void {
    const col = this.contextMenuCol();
    if (!col) return;
    const widths = { ...this.columnWidths() };
    delete widths[col.field];
    this.columnWidths.set(widths);
    this.debouncedSave();
  }

  // ─── Column Resize ───
  onResizeStart(field: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizingField = field;
    this.resizeStartX = event.clientX;

    const th = (event.target as HTMLElement).closest('th');
    this.resizeStartWidth = th ? th.offsetWidth : 100;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.resizingField) return;
      const diff = e.clientX - this.resizeStartX;
      const newWidth = Math.max(50, this.resizeStartWidth + diff);
      const widths = { ...this.columnWidths() };
      widths[this.resizingField] = `${newWidth}px`;
      this.columnWidths.set(widths);
    };

    const onMouseUp = () => {
      this.resizingField = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.debouncedSave();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onResizeDoubleClick(field: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const widths = { ...this.columnWidths() };
    delete widths[field];
    this.columnWidths.set(widths);
    this.debouncedSave();
  }

  // ─── Preferences ───
  private loadPreferences(): void {
    const saved = this.prefs.get<TablePreferences>(`table:${this.tableId()}`);
    if (!saved) {
      this.columnOrder.set(this.columns().map(c => c.field));
      return;
    }

    if (saved.columnVisibility) this.columnVisibility.set(saved.columnVisibility);
    if (saved.columnOrder?.length) this.columnOrder.set(saved.columnOrder);
    else this.columnOrder.set(this.columns().map(c => c.field));
    if (saved.columnWidths) this.columnWidths.set(saved.columnWidths);
    if (saved.sortState) this.sortStates.set(saved.sortState);
    if (saved.pageSize) this.pageSize.set(saved.pageSize);
    if (saved.filters) this.filters.set(saved.filters);
  }

  private savePreferences(): void {
    const prefs: TablePreferences = {
      columnVisibility: this.columnVisibility(),
      columnOrder: this.columnOrder(),
      columnWidths: this.columnWidths(),
      sortState: this.sortStates(),
      pageSize: this.pageSize(),
      filters: this.filters(),
    };
    this.prefs.set(`table:${this.tableId()}`, prefs);
  }

  private debouncedSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.savePreferences(), 500);
  }

  private requestServerSort(col: ColumnDef | null, order: 'asc' | 'desc'): void {
    const server = this.serverPaging();
    if (!server) return;
    this.sortStates.set(col ? [{ field: col.field, direction: order }] : []);
    this.debouncedSave();
    this.serverPageChange.emit({
      pageIndex: 0,
      pageSize: server.pageSize,
      sort: col ? col.sortField ?? col.field : null,
      order,
      ...this.serverFiltersPart(),
    });
  }

  private requestServerFilters(): void {
    const server = this.serverPaging();
    if (!server || !this.isServerFilterable()) return;
    this.serverPageChange.emit({
      pageIndex: 0,
      pageSize: server.pageSize,
      sort: server.sort,
      order: server.order,
      filters: this.serverFilterValues(),
    });
  }

  private serverFiltersPart(): Pick<ServerPageRequest, 'filters'> {
    return this.isServerFilterable() ? { filters: this.serverFilterValues() } : {};
  }

  private serverFilterValues(): Record<string, unknown> {
    const allowed = new Set(this.columns()
      .filter(c => c.filterable !== false && c.serverFilterable !== false)
      .map(c => c.field));
    return Object.fromEntries(Object.entries(this.filters()).filter(([field]) => allowed.has(field)));
  }

  protected getTrackValue(row: unknown): unknown {
    return (row as Record<string, unknown>)[this.trackByField()];
  }

  private getSelectedData(): unknown[] {
    const selected = this.selectedRows();
    return this.filteredData().filter(row => selected.has(this.getTrackValue(row)));
  }

  private pruneSelectionToFiltered(): void {
    const selected = this.selectedRows();
    if (!selected.size) return;
    const visible = new Set(this.filteredData().map(row => this.getTrackValue(row)));
    const kept = new Set([...selected].filter(key => visible.has(key)));
    if (kept.size === selected.size) return;
    this.selectedRows.set(kept);
    this.selectionChange.emit(this.getSelectedData());
  }
}

const sortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function isUtcMidnight(value: unknown): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime())
    && value.getUTCHours() === 0 && value.getUTCMinutes() === 0
    && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0;
}

function isBlankSortValue(value: unknown): boolean {
  return value == null || value === '';
}

function compareSortValues(a: unknown, b: unknown, type: ColumnDef['type']): number {
  if (type === 'number' || type === 'currency') {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  }
  if (typeof a === 'string' && typeof b === 'string') return sortCollator.compare(a, b);
  const x = a as number;
  const y = b as number;
  return x < y ? -1 : x > y ? 1 : 0;
}
