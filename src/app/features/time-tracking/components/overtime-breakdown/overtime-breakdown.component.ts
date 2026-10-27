import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { merge } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';
import { OvertimeBreakdown } from '../../models/overtime.model';
import { TimeTrackingService } from '../../services/time-tracking.service';

@Component({
  selector: 'app-overtime-breakdown',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DecimalPipe, CurrencyPipe, DataTableComponent, ColumnCellDirective, DatepickerComponent, SelectComponent],
  templateUrl: './overtime-breakdown.component.html',
  styleUrl: './overtime-breakdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OvertimeBreakdownComponent implements OnInit {
  private readonly service = inject(TimeTrackingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly userId = input<number | null>(null);

  protected readonly employeeControl = new FormControl<number | null>(null);
  protected readonly weekControl = new FormControl<Date | null>(new Date());
  protected readonly staffOptions = signal<SelectOption[]>([]);
  protected readonly breakdown = signal<OvertimeBreakdown | null>(null);
  protected readonly loading = signal(false);

  protected readonly fixedEmployee = computed(() => this.userId() !== null);
  protected readonly ruleSummary = computed(() => {
    const b = this.breakdown();
    if (!b?.ruleName) return '';
    return this.translate.instant(b.dailyThresholdsFirst ? 'timeTracking.overtime.ruleDaily' : 'timeTracking.overtime.ruleWeekly', {
      name: b.ruleName, daily: b.dailyThresholdHours ?? 0, weekly: b.weeklyThresholdHours ?? 0,
    });
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'date', header: this.translate.instant('timeTracking.colDate'), type: 'date', width: '120px' },
    { field: 'totalHours', header: this.translate.instant('timeTracking.overtime.total'), align: 'right' },
    { field: 'regularHours', header: this.translate.instant('timeTracking.overtime.regular'), align: 'right' },
    { field: 'overtimeHours', header: this.translate.instant('timeTracking.overtime.overtime'), align: 'right' },
    { field: 'doubletimeHours', header: this.translate.instant('timeTracking.overtime.doubletime'), align: 'right' },
  ];

  ngOnInit(): void {
    if (!this.fixedEmployee()) {
      this.service.getStaff().subscribe({
        next: staff => this.staffOptions.set(staff.map(s => ({ value: s.id, label: s.name }))),
        error: () => undefined,
      });
    }
    merge(this.employeeControl.valueChanges, this.weekControl.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
    this.load();
  }

  protected selectedUserId(): number | null {
    return this.userId() ?? this.employeeControl.value;
  }

  protected load(): void {
    const userId = this.selectedUserId();
    const week = toDateOnly(this.weekControl.value);
    if (!userId || !week) {
      this.breakdown.set(null);
      return;
    }
    this.loading.set(true);
    this.service.getOvertimeBreakdown(userId, week).subscribe({
      next: b => { this.breakdown.set(b); this.loading.set(false); },
      error: (err: unknown) => { this.loading.set(false); this.breakdown.set(null); this.snackbar.errorFrom(err, 'timeTracking.overtime.loadFailed'); },
    });
  }
}
