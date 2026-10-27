import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { SalesOrderStage } from '../../models/sales-order-stage.model';
import { StageLineAllocationRow } from '../../models/stage-line-allocation-row.model';

/**
 * Assigns sales order line quantities to one stage. A line can be split across stages; the quantity entered here
 * plus what the other stages hold may not exceed what the line ordered.
 */
@Component({
  selector: 'app-stage-lines-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, TranslatePipe, DialogComponent, InputComponent, ValidationButtonComponent],
  templateUrl: './stage-lines-dialog.component.html',
  styleUrl: './stage-lines-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StageLinesDialogComponent implements OnInit {
  private readonly soService = inject(SalesOrderService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stage = input.required<SalesOrderStage>();
  readonly stages = input.required<SalesOrderStage[]>();
  readonly lines = input.required<SalesOrderLine[]>();

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly quantities = new FormArray<FormControl<number | null>>([]);
  protected readonly violations = signal<string[]>([]);

  protected readonly rows = computed<StageLineAllocationRow[]>(() => {
    const stage = this.stage();
    const elsewhere = new Map<number, number>();
    for (const other of this.stages()) {
      if (other.id === stage.id) continue;
      for (const l of other.lines) elsewhere.set(l.salesOrderLineId, (elsewhere.get(l.salesOrderLineId) ?? 0) + l.quantity);
    }
    return this.lines()
      .filter(l => l.shipsGoods !== false && l.lineType !== 'Freight')
      .map(l => {
        const held = elsewhere.get(l.id) ?? 0;
        return {
          salesOrderLineId: l.id,
          lineNumber: l.lineNumber,
          label: l.partNumber ? `${l.partNumber} — ${l.description}` : l.description,
          ordered: l.quantity,
          elsewhere: held,
          available: Math.max(0, l.quantity - held),
        };
      });
  });

  ngOnInit(): void {
    const current = new Map(this.stage().lines.map(l => [l.salesOrderLineId, l.quantity]));
    for (const row of this.rows()) {
      this.quantities.push(new FormControl<number | null>(current.get(row.salesOrderLineId) ?? 0,
        [Validators.min(0), Validators.max(row.available)]));
    }
    this.quantities.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.violations.set(this.computeViolations()));
    this.violations.set(this.computeViolations());
  }

  private computeViolations(): string[] {
    const rows = this.rows();
    return this.quantities.controls.flatMap((control, i) => {
      if (!control.invalid) return [];
      const row = rows[i];
      return [this.translate.instant('salesOrderEngines.stages.overAllocated', { line: row.lineNumber, available: row.available })];
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.quantities.invalid || this.saving()) return;
    const rows = this.rows();
    const lines = this.quantities.controls
      .map((control, i) => ({ salesOrderLineId: rows[i].salesOrderLineId, quantity: control.value ?? 0 }))
      .filter(l => l.quantity > 0);
    this.saving.set(true);
    this.soService.assignStageLines(this.stage().id, lines).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('salesOrderEngines.stages.linesSaved', { name: this.stage().name }));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
