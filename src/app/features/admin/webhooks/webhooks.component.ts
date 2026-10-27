import { DecimalPipe, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { WebhooksService } from '../services/webhooks.service';
import { WebhookDelivery, WebhookSubscription } from '../models/webhook.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';

const ALL_EVENTS = '*';

function headersObject(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value?.trim();
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const ok = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      && Object.values(parsed as Record<string, unknown>).every(v => typeof v === 'string');
    return ok ? null : { headers: true };
  } catch {
    return { headers: true };
  }
}

/**
 * Outbound webhook subscriptions — create and edit subscriptions, send a test ping, read each
 * subscription's delivery log and redeliver a past payload. The signing secret is shown once,
 * when it is created or rotated; the server never returns it again.
 */
@Component({
  selector: 'app-webhooks',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateTimePipe, DecimalPipe, SlicePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './webhooks.component.html',
  styleUrl: './webhooks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebhooksComponent {
  private readonly service = inject(WebhooksService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly subscriptions = signal<WebhookSubscription[]>([]);
  protected readonly eventOptions = signal<SelectOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly testingId = signal<number | null>(null);

  protected readonly showEditor = signal(false);
  protected readonly editing = signal<WebhookSubscription | null>(null);
  protected readonly revealedSecret = signal<string | null>(null);

  protected readonly deliveriesFor = signal<WebhookSubscription | null>(null);
  protected readonly deliveries = signal<WebhookDelivery[]>([]);
  protected readonly deliveriesLoading = signal(false);
  protected readonly redeliveringId = signal<number | null>(null);
  protected readonly expandedDeliveryId = signal<number | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'url', header: this.translate.instant('webhooksAdmin.cols.url'), sortable: true },
    { field: 'events', header: this.translate.instant('webhooksAdmin.cols.events'), width: '220px' },
    { field: 'status', header: this.translate.instant('webhooksAdmin.cols.status'), width: '130px' },
    { field: 'lastDeliveredAt', header: this.translate.instant('webhooksAdmin.cols.lastDelivered'), sortable: true, type: 'date', width: '170px' },
    { field: 'actions', header: '', width: '190px', align: 'right' },
  ];

  protected readonly deliveryColumns: ColumnDef[] = [
    { field: 'attemptedAt', header: this.translate.instant('webhooksAdmin.deliveryCols.attemptedAt'), sortable: true, type: 'date', width: '170px' },
    { field: 'eventType', header: this.translate.instant('webhooksAdmin.deliveryCols.event'), sortable: true },
    { field: 'statusCode', header: this.translate.instant('webhooksAdmin.deliveryCols.status'), width: '110px' },
    { field: 'durationMs', header: this.translate.instant('webhooksAdmin.deliveryCols.duration'), width: '100px', align: 'right' },
    { field: 'detail', header: this.translate.instant('webhooksAdmin.deliveryCols.response') },
    { field: 'actions', header: '', width: '80px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    url: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000), Validators.pattern(/^https?:\/\/.+/i)] }),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    allEvents: new FormControl<boolean>(false, { nonNullable: true }),
    eventTypes: new FormControl<string[]>([], { nonNullable: true }),
    maxRetries: new FormControl<number>(5, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(20)] }),
    autoDisableOnFailure: new FormControl<boolean>(true, { nonNullable: true }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
    headersJson: new FormControl<string>('', { nonNullable: true, validators: [headersObject] }),
    rotateSecret: new FormControl<boolean>(false, { nonNullable: true }),
  }, { validators: (g) => this.hasEvents(g) ? null : { events: true } });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    url: this.translate.instant('webhooksAdmin.fieldUrl'),
    maxRetries: this.translate.instant('webhooksAdmin.fieldMaxRetries'),
    headersJson: this.translate.instant('webhooksAdmin.fieldHeaders'),
  });

  constructor() {
    this.load();
    this.service.eventTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (types) => this.eventOptions.set(types.map(t => ({ value: t, label: t }))),
    });
  }

  private hasEvents(group: AbstractControl): boolean {
    const value = (group as FormGroup).getRawValue() as { allEvents: boolean; eventTypes: string[] };
    return value.allEvents || value.eventTypes.length > 0;
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.subscriptions.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected events(row: WebhookSubscription): string[] {
    try {
      const parsed: unknown = JSON.parse(row.eventTypesJson);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  protected statusKey(row: WebhookSubscription): string {
    if (!row.isActive) return 'webhooksAdmin.statusInactive';
    return row.failureCount > 0 ? 'webhooksAdmin.statusFailing' : 'webhooksAdmin.statusActive';
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      url: '', description: '', allEvents: false, eventTypes: [], maxRetries: 5,
      autoDisableOnFailure: true, isActive: true, headersJson: '', rotateSecret: false,
    });
    this.showEditor.set(true);
  }

  protected openEdit(row: WebhookSubscription): void {
    const events = this.events(row);
    this.editing.set(row);
    this.form.reset({
      url: row.url,
      description: row.description ?? '',
      allEvents: events.includes(ALL_EVENTS),
      eventTypes: events.filter(e => e !== ALL_EVENTS),
      maxRetries: row.maxRetries,
      autoDisableOnFailure: row.autoDisableOnFailure,
      isActive: row.isActive,
      headersJson: row.headersJson ?? '',
      rotateSecret: false,
    });
    this.showEditor.set(true);
  }

  protected closeEditor(): void {
    this.showEditor.set(false);
    this.editing.set(null);
  }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    const eventTypesJson = JSON.stringify(f.allEvents ? [ALL_EVENTS] : f.eventTypes);
    const headersJson = f.headersJson.trim() || null;
    const description = f.description.trim() || null;
    const editing = this.editing();
    this.saving.set(true);

    const request$ = editing
      ? this.service.update(editing.id, {
        url: f.url.trim(), eventTypesJson, description, headersJson, maxRetries: f.maxRetries,
        autoDisableOnFailure: f.autoDisableOnFailure, isActive: f.isActive, rotateSecret: f.rotateSecret,
      })
      : this.service.create({
        url: f.url.trim(), eventTypesJson, secret: null, description, headersJson, maxRetries: f.maxRetries,
        autoDisableOnFailure: f.autoDisableOnFailure,
      });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(editing ? 'webhooksAdmin.updated' : 'webhooksAdmin.created'));
        this.closeEditor();
        if (saved.secret) this.revealedSecret.set(saved.secret);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'webhooksAdmin.saveFailed');
      },
    });
  }

  protected closeSecret(): void {
    this.revealedSecret.set(null);
  }

  protected copySecret(): void {
    const secret = this.revealedSecret();
    if (!secret) return;
    navigator.clipboard?.writeText(secret).then(
      () => this.snackbar.success(this.translate.instant('webhooksAdmin.secretCopied')),
      () => this.snackbar.error(this.translate.instant('webhooksAdmin.copyFailed')),
    );
  }

  protected test(row: WebhookSubscription): void {
    this.testingId.set(row.id);
    this.service.test(row.id).subscribe({
      next: (delivery) => {
        this.testingId.set(null);
        if (delivery.isSuccess) {
          this.snackbar.success(this.translate.instant('webhooksAdmin.testSucceeded', { status: delivery.statusCode ?? '' }));
        } else {
          this.snackbar.error(this.translate.instant('webhooksAdmin.testFailed', { reason: delivery.errorMessage ?? delivery.statusCode ?? '' }));
        }
        this.load();
        if (this.deliveriesFor()?.id === row.id) this.loadDeliveries(row);
      },
      error: (err: unknown) => {
        this.testingId.set(null);
        this.snackbar.errorFrom(err, 'webhooksAdmin.testFailedGeneric');
      },
    });
  }

  protected confirmDelete(row: WebhookSubscription): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('webhooksAdmin.deleteTitle'),
        message: this.translate.instant('webhooksAdmin.deleteConfirm', { url: row.url }),
        confirmLabel: this.translate.instant('common.delete'),
        cancelLabel: this.translate.instant('common.cancel'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('webhooksAdmin.deleted'));
          this.load();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'webhooksAdmin.deleteFailed'),
      });
    });
  }

  protected openDeliveries(row: WebhookSubscription): void {
    this.deliveriesFor.set(row);
    this.expandedDeliveryId.set(null);
    this.loadDeliveries(row);
  }

  protected closeDeliveries(): void {
    this.deliveriesFor.set(null);
    this.deliveries.set([]);
  }

  private loadDeliveries(row: WebhookSubscription): void {
    this.deliveriesLoading.set(true);
    this.service.deliveries(row.id).subscribe({
      next: (rows) => {
        this.deliveries.set(rows);
        this.deliveriesLoading.set(false);
      },
      error: () => this.deliveriesLoading.set(false),
    });
  }

  protected toggleDetail(delivery: WebhookDelivery): void {
    this.expandedDeliveryId.update(id => id === delivery.id ? null : delivery.id);
  }

  protected redeliver(delivery: WebhookDelivery): void {
    const subscription = this.deliveriesFor();
    this.redeliveringId.set(delivery.id);
    this.service.redeliver(delivery.id).subscribe({
      next: (result) => {
        this.redeliveringId.set(null);
        if (result.isSuccess) this.snackbar.success(this.translate.instant('webhooksAdmin.redelivered'));
        else this.snackbar.error(this.translate.instant('webhooksAdmin.testFailed', { reason: result.errorMessage ?? result.statusCode ?? '' }));
        if (subscription) this.loadDeliveries(subscription);
      },
      error: (err: unknown) => {
        this.redeliveringId.set(null);
        this.snackbar.errorFrom(err, 'webhooksAdmin.redeliverFailed');
      },
    });
  }
}
