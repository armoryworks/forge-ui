import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { addDays, format, startOfWeek } from 'date-fns';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { RowExpandDirective } from '../../shared/directives/row-expand.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { SelectOption } from '../../shared/components/select/select.component';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import {
  PieceRateCompliance,
  PieceRateTimeline,
  PieceWorkEntry,
} from './models/piece-rate.model';
import { PieceRatesService } from './services/piece-rates.service';

/**
 * The easy face of piece rates. Three flat sections, no wizards:
 *   1. rates — one row per part with its current rate; setting a rate just
 *      starts a new timeline row (history behind the expand chevron);
 *   2. log pieces — worker, part, date, quantity; the server resolves the
 *      rate in force that day and pins it;
 *   3. weekly check — pick any date, see that workweek's minimum-wage
 *      make-up per worker.
 */
@Component({
  selector: 'app-piece-rates',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DatePipe, DecimalPipe, CurrencyPipe,
    PageLayoutComponent, DataTableComponent, ColumnCellDirective, RowExpandDirective,
    EntityPickerComponent, SelectComponent, DatepickerComponent, CurrencyInputComponent, InputComponent,
  ],
  templateUrl: './piece-rates.component.html',
  styleUrl: './piece-rates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PieceRatesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PieceRatesService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rates = signal<PieceRateTimeline[]>([]);
  protected readonly work = signal<PieceWorkEntry[]>([]);
  protected readonly compliance = signal<PieceRateCompliance | null>(null);
  protected readonly userOptions = signal<SelectOption[]>([]);
  protected readonly savingRate = signal(false);
  protected readonly savingWork = signal(false);

  protected readonly rateForm = this.fb.group({
    partId: this.fb.control<number | null>(null, Validators.required),
    rate: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    effectiveFrom: this.fb.control<Date | null>(null),
  });

  protected readonly workForm = this.fb.group({
    userId: this.fb.control<number | null>(null, Validators.required),
    partId: this.fb.control<number | null>(null, Validators.required),
    date: this.fb.control<Date | null>(new Date(), Validators.required),
    quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });

  protected readonly weekControl = this.fb.control<Date | null>(new Date());

  protected readonly totalMakeup = computed(() => this.compliance()?.totalMakeupOwed ?? 0);

  protected readonly rateColumns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '140px' },
    { field: 'partDescription', header: 'Description', sortable: true },
    { field: 'current', header: 'Current rate', width: '130px', align: 'right' },
    { field: 'since', header: 'Since', width: '110px' },
  ];

  protected readonly workColumns: ColumnDef[] = [
    { field: 'workDate', header: 'Date', sortable: true, type: 'date', width: '110px' },
    { field: 'userName', header: 'Worker', sortable: true },
    { field: 'partNumber', header: 'Part #', sortable: true, width: '130px' },
    { field: 'quantity', header: 'Pieces', width: '90px', align: 'right' },
    { field: 'rateSnapshot', header: 'Rate', width: '100px', align: 'right' },
    { field: 'earnings', header: 'Earned', width: '110px', align: 'right' },
    { field: 'actions', header: '', width: '60px' },
  ];

  protected readonly complianceColumns: ColumnDef[] = [
    { field: 'userName', header: 'Worker', sortable: true },
    { field: 'stateCode', header: 'State', width: '70px' },
    { field: 'minimumWage', header: 'Min wage', width: '100px', align: 'right' },
    { field: 'hoursWorked', header: 'Hours', width: '90px', align: 'right' },
    { field: 'pieceEarnings', header: 'Piece pay', width: '110px', align: 'right' },
    { field: 'requiredFloor', header: 'Floor', width: '110px', align: 'right' },
    { field: 'makeupOwed', header: 'Make-up owed', width: '130px', align: 'right' },
    { field: 'effectiveHourly', header: 'Effective /hr', width: '110px', align: 'right' },
  ];

  constructor() {
    this.loadRates();
    this.loadUsers();
    this.loadWeek();
    this.weekControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadWeek());
  }

  private weekStart(): string {
    const anchor = this.weekControl.value ?? new Date();
    return format(startOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  }

  private loadRates(): void {
    this.service.getRates().subscribe({
      next: (rates) => this.rates.set(rates),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'pieceRates.loadFailed'),
    });
  }

  private loadUsers(): void {
    this.service.getUsers().subscribe({
      next: (users) => this.userOptions.set(users.map((u) => ({ value: u.id, label: u.name }))),
      error: () => undefined,
    });
  }

  private loadWeek(): void {
    const start = this.weekStart();
    const end = format(addDays(new Date(`${start}T00:00:00`), 6), 'yyyy-MM-dd');
    this.service.getWork(start, end, null).subscribe({
      next: (entries) => this.work.set(entries),
      error: () => undefined,
    });
    this.service.getCompliance(start).subscribe({
      next: (report) => this.compliance.set(report),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'pieceRates.loadFailed'),
    });
  }

  protected setRate(): void {
    if (this.rateForm.invalid || this.savingRate()) return;
    const v = this.rateForm.getRawValue();
    this.savingRate.set(true);
    this.service
      .setRate(v.partId!, v.rate!, v.effectiveFrom ? format(v.effectiveFrom, 'yyyy-MM-dd') : null, null)
      .subscribe({
        next: () => {
          this.savingRate.set(false);
          this.rateForm.reset();
          this.snackbar.success(this.translate.instant('pieceRates.rateSet'));
          this.loadRates();
        },
        error: (err: unknown) => {
          this.savingRate.set(false);
          this.snackbar.errorFrom(err, 'pieceRates.rateSetFailed');
        },
      });
  }

  protected logWork(): void {
    if (this.workForm.invalid || this.savingWork()) return;
    const v = this.workForm.getRawValue();
    this.savingWork.set(true);
    this.service
      .logWork(v.userId!, v.partId!, format(v.date!, 'yyyy-MM-dd'), v.quantity!)
      .subscribe({
        next: (entry) => {
          this.savingWork.set(false);
          this.workForm.patchValue({ quantity: null });
          this.snackbar.success(this.translate.instant('pieceRates.workLogged', { earnings: entry.earnings }));
          this.loadWeek();
        },
        error: (err: unknown) => {
          this.savingWork.set(false);
          this.snackbar.errorFrom(err, 'pieceRates.workLogFailed');
        },
      });
  }

  protected deleteWork(entry: PieceWorkEntry): void {
    this.service.deleteWork(entry.id).subscribe({
      next: () => this.loadWeek(),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'pieceRates.deleteFailed'),
    });
  }
}
