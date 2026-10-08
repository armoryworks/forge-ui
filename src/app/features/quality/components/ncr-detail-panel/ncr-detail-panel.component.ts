import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { NcrCapaService } from '../../services/ncr-capa.service';
import { NonConformance } from '../../models/non-conformance.model';
import { NcrStatus } from '../../models/ncr-status.model';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

type StatusAction = 'close' | 'reopen';

const CONTAINABLE: readonly NcrStatus[] = ['Open', 'UnderReview'];
const DISPOSITIONABLE: readonly NcrStatus[] = ['Open', 'UnderReview', 'Contained'];

@Component({
  selector: 'app-ncr-detail-panel',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, ReactiveFormsModule, TranslatePipe,
    EntityActivitySectionComponent, DialogComponent, TextareaComponent,
    CurrencyInputComponent, CurrencyDisplayComponent, ValidationButtonComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './ncr-detail-panel.component.html',
  styleUrl: './ncr-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NcrDetailPanelComponent {
  private readonly ncrCapaService = inject(NcrCapaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  readonly ncrId = input.required<number>();
  readonly refresh = input(0);

  readonly dispositionRequested = output<NonConformance>();
  readonly changed = output<void>();

  protected readonly ncr = signal<NonConformance | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly statusAction = signal<StatusAction | null>(null);

  protected readonly canCloseOrReopen = this.auth.hasAnyRole(['Admin', 'Manager']);

  protected readonly canContain = computed(() => {
    const n = this.ncr();
    return !!n && CONTAINABLE.includes(n.status);
  });
  protected readonly canDisposition = computed(() => {
    const n = this.ncr();
    return !!n && DISPOSITIONABLE.includes(n.status);
  });
  protected readonly costsEditable = computed(() => {
    const n = this.ncr();
    return !!n && n.status !== 'Closed';
  });

  protected readonly containmentControl = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] });

  protected readonly costForm = new FormGroup({
    materialCost: new FormControl<number | null>(null, [Validators.min(0)]),
    laborCost: new FormControl<number | null>(null, [Validators.min(0)]),
  });

  protected readonly reasonControl = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] });
  protected readonly reasonForm = new FormGroup({ reason: this.reasonControl });

  protected readonly costViolations = FormValidationService.getViolations(this.costForm, {
    materialCost: this.translate.instant('ncrDetail.materialCost'),
    laborCost: this.translate.instant('ncrDetail.laborCost'),
  });

  protected readonly reasonViolations = FormValidationService.getViolations(this.reasonForm, {
    reason: this.translate.instant('ncrDetail.reopenReason'),
  });

  constructor() {
    effect(() => {
      const id = this.ncrId();
      this.refresh();
      untracked(() => this.load(id));
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.ncrCapaService.getNcr(id).subscribe({
      next: ncr => {
        this.applyNcr(ncr);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private applyNcr(ncr: NonConformance): void {
    this.ncr.set(ncr);
    this.containmentControl.reset(ncr.containmentActions ?? '');
    this.costForm.reset({ materialCost: ncr.materialCost, laborCost: ncr.laborCost });
  }

  private afterChange(id: number, messageKey: string): void {
    this.snackbar.success(this.translate.instant(messageKey));
    this.saving.set(false);
    this.changed.emit();
    this.load(id);
  }

  protected markContained(): void {
    const ncr = this.ncr();
    const actions = this.containmentControl.value.trim();
    if (!ncr || !actions || this.containmentControl.invalid) return;
    this.saving.set(true);
    this.ncrCapaService.containNcr(ncr.id, actions).subscribe({
      next: () => this.afterChange(ncr.id, 'ncrDetail.contained'),
      error: () => this.saving.set(false),
    });
  }

  protected saveCosts(): void {
    const ncr = this.ncr();
    if (!ncr || this.costForm.invalid || !this.costsEditable()) return;
    const { materialCost, laborCost } = this.costForm.getRawValue();
    this.saving.set(true);
    this.ncrCapaService.updateNcr(ncr.id, {
      materialCost: materialCost ?? undefined,
      laborCost: laborCost ?? undefined,
    }).subscribe({
      next: () => this.afterChange(ncr.id, 'ncrDetail.costsSaved'),
      error: () => this.saving.set(false),
    });
  }

  protected requestDisposition(): void {
    const ncr = this.ncr();
    if (ncr) this.dispositionRequested.emit(ncr);
  }

  protected openStatusAction(action: StatusAction): void {
    this.reasonControl.setValidators(action === 'reopen'
      ? [Validators.required, Validators.maxLength(2000)]
      : [Validators.maxLength(2000)]);
    this.reasonControl.reset('');
    this.statusAction.set(action);
  }

  protected closeStatusAction(): void {
    this.statusAction.set(null);
  }

  protected confirmStatusAction(): void {
    const ncr = this.ncr();
    const action = this.statusAction();
    const reason = this.reasonControl.value.trim();
    if (!ncr || !action || this.reasonForm.invalid || (action === 'reopen' && !reason)) return;
    this.saving.set(true);
    const call = action === 'close'
      ? this.ncrCapaService.closeNcr(ncr.id, reason || undefined)
      : this.ncrCapaService.reopenNcr(ncr.id, reason);
    call.subscribe({
      next: () => {
        this.statusAction.set(null);
        this.afterChange(ncr.id, action === 'close' ? 'ncrDetail.closed' : 'ncrDetail.reopened');
      },
      error: () => this.saving.set(false),
    });
  }

  protected getStatusClass(status: NcrStatus): string {
    switch (status) {
      case 'Open': return 'chip chip--error';
      case 'UnderReview': return 'chip chip--warning';
      case 'Contained': return 'chip chip--info';
      case 'Dispositioned': return 'chip chip--primary';
      case 'Closed': return 'chip chip--muted';
      default: return 'chip';
    }
  }
}
