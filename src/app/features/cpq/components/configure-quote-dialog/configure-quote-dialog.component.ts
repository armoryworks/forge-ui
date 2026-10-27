import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Observable, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfiguratorDetail } from '../../models/configurator-detail.model';
import { CpqResult } from '../../models/cpq-result.model';
import { CpqSelection } from '../../models/cpq-selection.model';
import { ProductConfiguration } from '../../models/product-configuration.model';
import { CpqService } from '../../services/cpq.service';
import { ConfiguratorFormComponent } from '../configurator-form/configurator-form.component';

/**
 * "New configured quote": pick a configurator and a customer, fill the options with live validation and price,
 * then generate a Draft quote in the customer's currency (optionally creating the configured part first), or
 * only the configured part.
 */
@Component({
  selector: 'app-configure-quote-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, EntityPickerComponent, SelectComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective, ConfiguratorFormComponent],
  templateUrl: './configure-quote-dialog.component.html',
  styleUrl: './configure-quote-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigureQuoteDialogComponent implements OnInit {
  private readonly cpq = inject(CpqService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly configuratorId = input<number | null>(null);
  readonly allowQuote = input(true);
  readonly closed = output<void>();
  readonly quoteCreated = output<number>();
  readonly partCreated = output<number>();

  protected readonly configuratorControl = new FormControl<number | null>(null);
  protected readonly customerControl = new FormControl<number | null>(null);
  protected readonly createPartControl = new FormControl(true, { nonNullable: true });

  protected readonly configuratorOptions = signal<SelectOption[]>([]);
  protected readonly configurator = signal<ConfiguratorDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly selection = signal<CpqSelection | null>(null);
  protected readonly result = signal<CpqResult | null>(null);

  private readonly customerId = toSignal(this.customerControl.valueChanges, { initialValue: null });

  protected readonly quoteViolations = computed(() => {
    const issues: string[] = [];
    if (!this.configurator()) issues.push(this.translate.instant('cpq.configure.pickConfigurator'));
    if (!this.customerId()) issues.push(this.translate.instant('cpq.configure.pickCustomer'));
    issues.push(...this.priceIssues());
    return issues;
  });
  protected readonly partViolations = computed(() => {
    const issues: string[] = [];
    if (!this.configurator()) issues.push(this.translate.instant('cpq.configure.pickConfigurator'));
    issues.push(...this.priceIssues());
    return issues;
  });
  private readonly priceIssues = computed(() => {
    const result = this.result();
    if (!this.configurator()) return [];
    if (!result) return [this.translate.instant('cpq.configure.notPriced')];
    return result.validationErrors;
  });

  ngOnInit(): void {
    this.cpq.getConfigurators(true).subscribe({
      next: list => this.configuratorOptions.set(list.map(c => ({ value: c.id, label: `${c.name} (${c.basePartNumber})` }))),
    });
    this.configuratorControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => this.loadConfigurator(id));
    const preset = this.configuratorId();
    if (preset) this.configuratorControl.setValue(preset);
  }

  private loadConfigurator(id: number | null): void {
    this.configurator.set(null);
    this.result.set(null);
    this.selection.set(null);
    if (!id) return;
    this.loading.set(true);
    this.cpq.getConfigurator(id).subscribe({
      next: detail => { this.configurator.set(detail); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected onSelection(selection: CpqSelection): void {
    this.selection.set(selection);
  }

  protected onResult(result: CpqResult | null): void {
    this.result.set(result);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected generateQuote(): void {
    const customerId = this.customerControl.value;
    if (!customerId || this.quoteViolations().length > 0) return;
    this.run(config => this.cpq.generateQuote(config.id, customerId, this.createPartControl.value), (r: { quoteId: number }) => {
      this.snackbar.success(this.translate.instant('cpq.configure.quoteCreated'));
      this.quoteCreated.emit(r.quoteId);
    });
  }

  protected generatePart(): void {
    if (this.partViolations().length > 0) return;
    this.run(config => this.cpq.generatePart(config.id), (r: { partId: number }) => {
      this.snackbar.success(this.translate.instant('cpq.configure.partCreated'));
      this.partCreated.emit(r.partId);
    });
  }

  private run<T>(next: (config: ProductConfiguration) => Observable<T>, done: (value: T) => void): void {
    const configurator = this.configurator();
    const selection = this.selection();
    if (!configurator || !selection || this.saving()) return;
    this.saving.set(true);
    this.cpq.saveConfiguration(configurator.id, selection.selections, selection.quantity)
      .pipe(switchMap(next))
      .subscribe({
        next: value => { this.saving.set(false); done(value); },
        error: () => this.saving.set(false),
      });
  }
}
