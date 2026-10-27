import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetail } from '../../models/employee.model';
import { EmployeeKind } from '../../models/employee-kind.model';
import { FinalPaySummary } from '../../models/final-pay-summary.model';
import { EmployeeRehireDialogComponent } from '../employee-rehire-dialog/employee-rehire-dialog.component';
import { EmployeeTerminateDialogData } from '../employee-terminate-dialog/employee-terminate-dialog-data.model';
import { TERMINATION_REASON_GROUP } from '../employee-terminate-dialog/employee-terminate-dialog.component';

@Component({
  selector: 'app-employee-termination-panel',
  standalone: true,
  imports: [TranslatePipe, DateOnlyPipe, DateTimePipe, DecimalPipe, CurrencyPipe],
  templateUrl: './employee-termination-panel.component.html',
  styleUrl: './employee-termination-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeTerminationPanelComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  readonly employee = input.required<EmployeeDetail>();
  readonly kind = input.required<EmployeeKind>();
  readonly changed = output<void>();

  protected readonly summary = signal<FinalPaySummary | null>(null);
  protected readonly processing = signal(false);
  private readonly reasonLabels = signal<Record<string, string>>({});

  protected readonly termination = computed(() => this.employee().termination ?? null);
  protected readonly applied = computed(() => !!this.termination()?.appliedAt);
  protected readonly reasonLabel = computed(() => {
    const code = this.termination()?.reasonCode ?? '';
    return this.reasonLabels()[code] ?? code;
  });
  protected readonly canMarkProcessed = computed(() => {
    const t = this.termination();
    return !!t && this.applied() && t.finalPayRequired && !t.finalPayProcessedAt;
  });

  constructor() {
    this.referenceData.getByGroup(TERMINATION_REASON_GROUP).subscribe({
      next: items => this.reasonLabels.set(Object.fromEntries(items.map(i => [i.code, i.label]))),
      error: () => this.reasonLabels.set({}),
    });

    effect(() => {
      const e = this.employee();
      if (e.termination) this.loadSummary(e.id, this.kind());
    });
  }

  private loadSummary(id: number, kind: EmployeeKind): void {
    this.employeeService.getFinalPaySummary(id, kind).subscribe({
      next: s => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }

  protected rehire(): void {
    this.dialog.open<EmployeeRehireDialogComponent, EmployeeTerminateDialogData, boolean>(EmployeeRehireDialogComponent, {
      width: '460px',
      data: { employee: this.employee(), kind: this.kind() },
    }).afterClosed().subscribe(done => {
      if (done) this.changed.emit();
    });
  }

  protected markProcessed(): void {
    if (this.processing()) return;
    this.processing.set(true);
    this.employeeService.markFinalPayProcessed(this.employee().id, this.kind()).subscribe({
      next: () => {
        this.processing.set(false);
        this.snackbar.success(this.translate.instant('employees.termination.finalPayMarked'));
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.processing.set(false);
        this.snackbar.errorFrom(err, 'employees.termination.finalPayFailed');
      },
    });
  }
}
