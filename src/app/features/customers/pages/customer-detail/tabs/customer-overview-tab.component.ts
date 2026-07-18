import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerSummary } from '../../../models/customer-summary.model';
import { CustomerService } from '../../../services/customer.service';
import { CreditStatusCardComponent } from '../../../components/credit-status-card/credit-status-card.component';
import { ContactInteractionDialogComponent, ContactInteractionDialogData } from '../../../components/contact-interaction-dialog/contact-interaction-dialog.component';
import { ContactInteraction } from '../../../models/contact-interaction.model';
import { CapDirective } from '../../../../../shared/directives/cap.directive';
import { RecentCommunicationsComponent } from '../../../../../shared/components/recent-communications/recent-communications.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface ComplianceFlagDef {
  key: 'isFdaRegulated' | 'isAerospace' | 'isAutomotive' | 'isItarControlled';
  labelKey: string;
  helpKey: string;
}

@Component({
  selector: 'app-customer-overview-tab',
  standalone: true,
  imports: [
    DatePipe, TranslatePipe, MatSlideToggleModule, ReactiveFormsModule,
    CreditStatusCardComponent, CapDirective, RecentCommunicationsComponent, TextareaComponent,
  ],
  templateUrl: './customer-overview-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOverviewTabComponent {
  private readonly service = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  readonly customer = input.required<CustomerSummary>();
  readonly customerUpdated = output<void>();

  protected readonly pendingFlags = signal<Set<string>>(new Set());
  protected readonly editingNotes = signal(false);
  protected readonly notesControl = new FormControl<string>('', { nonNullable: true });

  /** Bumped after logging an interaction so the Recent Communications widget
   *  re-fetches its feed to show the fresh entry. */
  protected readonly commRefreshKey = signal(0);

  protected readonly complianceFlags: ComplianceFlagDef[] = [
    { key: 'isFdaRegulated', labelKey: 'customers.compliance.fdaRegulated', helpKey: 'customers.compliance.fdaRegulatedHelp' },
    { key: 'isAerospace', labelKey: 'customers.compliance.aerospace', helpKey: 'customers.compliance.aerospaceHelp' },
    { key: 'isAutomotive', labelKey: 'customers.compliance.automotive', helpKey: 'customers.compliance.automotiveHelp' },
    { key: 'isItarControlled', labelKey: 'customers.compliance.itarControlled', helpKey: 'customers.compliance.itarControlledHelp' },
  ];

  protected readonly hasComplianceFlag = computed(() => {
    const c = this.customer();
    return !!(c.isFdaRegulated || c.isAerospace || c.isAutomotive || c.isItarControlled);
  });

  protected isPending(key: string): boolean {
    return this.pendingFlags().has(key);
  }

  protected toggleFlag(key: ComplianceFlagDef['key'], next: boolean): void {
    const c = this.customer();
    const pending = new Set(this.pendingFlags());
    pending.add(key);
    this.pendingFlags.set(pending);

    this.service.updateCustomer(c.id, { [key]: next }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('customers.compliance.flagUpdated'));
        this.clearPending(key);
        this.customerUpdated.emit();
      },
      error: () => this.clearPending(key),
    });
  }

  protected toggleReferenceOk(next: boolean): void {
    const c = this.customer();
    const pending = new Set(this.pendingFlags());
    pending.add('isReferenceOk');
    this.pendingFlags.set(pending);

    this.service.updateCustomer(c.id, { isReferenceOk: next }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant(next ? 'customers.compliance.referenceEnabled' : 'customers.compliance.referenceDisabled'));
        this.clearPending('isReferenceOk');
        this.customerUpdated.emit();
      },
      error: () => this.clearPending('isReferenceOk'),
    });
  }

  protected startEditNotes(): void {
    this.notesControl.setValue(this.customer().referenceNotes ?? '');
    this.notesControl.markAsPristine();
    this.editingNotes.set(true);
  }

  /**
   * Guard against silent loss of typed-but-unsaved reference notes. If the
   * control is dirty (user typed something since startEditNotes), ask
   * before exiting. native confirm() is sufficient here — the textual
   * loss is small and a full ConfirmDialog would be overkill.
   */
  protected cancelEditNotes(): void {
    if (this.notesControl.dirty) {
      const ok = window.confirm(this.translate.instant('customers.compliance.referenceNotesDiscardConfirm'));
      if (!ok) return;
    }
    this.editingNotes.set(false);
  }

  protected saveNotes(): void {
    const c = this.customer();
    const pending = new Set(this.pendingFlags());
    pending.add('referenceNotes');
    this.pendingFlags.set(pending);

    this.service.updateCustomer(c.id, { referenceNotes: this.notesControl.value }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('customers.compliance.referenceNotesSaved'));
        this.editingNotes.set(false);
        this.clearPending('referenceNotes');
        this.customerUpdated.emit();
      },
      error: () => this.clearPending('referenceNotes'),
    });
  }

  private clearPending(key: string): void {
    const pending = new Set(this.pendingFlags());
    pending.delete(key);
    this.pendingFlags.set(pending);
  }

  /**
   * Opens the shared contact-interaction dialog from the Recent Communications
   * widget's inline "Log" affordance. On save, bump the refresh key so the
   * widget re-fetches and the just-logged interaction appears immediately.
   */
  protected logInteraction(): void {
    this.dialog.open<ContactInteractionDialogComponent, ContactInteractionDialogData, ContactInteraction | null>(
      ContactInteractionDialogComponent,
      {
        width: '520px',
        data: { customerId: this.customer().id, interaction: null },
      },
    ).afterClosed().subscribe((saved) => {
      if (saved) this.commRefreshKey.update(k => k + 1);
    });
  }
}
