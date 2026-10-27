import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { ConfigureQuoteDialogComponent } from '../../components/configure-quote-dialog/configure-quote-dialog.component';
import { ConfiguratorEditorDialogComponent } from '../../components/configurator-editor-dialog/configurator-editor-dialog.component';
import { Configurator } from '../../models/configurator.model';
import { CPQ_AUTHOR_ROLES } from '../../models/cpq-author-roles.model';
import { CpqService } from '../../services/cpq.service';

/**
 * Sales > Configurators: the configure-to-order products. Admins and managers author them (options, rules,
 * pricing) and test-price them; the sales office opens one to test it or start a configured quote. The open
 * configurator lives in the URL (`?configurator=id` or `?configurator=new`).
 */
@Component({
  selector: 'app-configurators',
  standalone: true,
  imports: [TranslatePipe, CurrencyDisplayComponent, DataTableComponent, PageLayoutComponent, ColumnCellDirective, SpacerDirective,
    ConfiguratorEditorDialogComponent, ConfigureQuoteDialogComponent],
  templateUrl: './configurators.component.html',
  styleUrl: './configurators.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguratorsComponent implements OnInit {
  private readonly cpq = inject(CpqService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly configurators = signal<Configurator[]>([]);
  protected readonly loading = signal(false);
  protected readonly quoting = signal(false);
  protected readonly canAuthor = computed(() => this.auth.hasAnyRole([...CPQ_AUTHOR_ROLES]));

  private readonly openParam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('configurator'))), { initialValue: null });
  protected readonly editorOpen = computed(() => this.openParam() !== null);
  protected readonly editorId = computed(() => {
    const value = this.openParam();
    const id = value && value !== 'new' ? Number(value) : NaN;
    return Number.isFinite(id) ? id : null;
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('cpq.editor.name'), sortable: true },
    { field: 'basePartNumber', header: this.translate.instant('cpq.editor.basePart'), sortable: true, width: '160px' },
    { field: 'basePrice', header: this.translate.instant('cpq.editor.basePrice'), sortable: true, type: 'currency', width: '120px', align: 'right' },
    { field: 'optionCount', header: this.translate.instant('cpq.list.options'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'isActive', header: this.translate.instant('cpq.editor.active'), sortable: true, width: '100px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.cpq.getConfigurators().subscribe({
      next: list => { this.configurators.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openEditor(value: number | 'new'): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { configurator: value }, queryParamsHandling: 'merge' });
  }

  protected openRow(row: unknown): void {
    this.openEditor((row as Configurator).id);
  }

  protected closeEditor(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { configurator: null }, queryParamsHandling: 'merge' });
  }

  protected onSaved(): void {
    this.load();
    if (this.editorId() === null) this.closeEditor();
  }

  protected onQuoteCreated(quoteId: number): void {
    this.quoting.set(false);
    this.router.navigate(['/quotes'], { queryParams: { detail: `quote:${quoteId}` } });
  }
}
