import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { EdiService } from '../../services/edi.service';
import { EdiTradingPartner } from '../../models/edi-trading-partner.model';
import { EdiTransaction } from '../../models/edi-transaction.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

export type EdiSendEntityType = 'sales-order' | 'shipment' | 'invoice';

const SEND_ROLES = ['Admin', 'Manager'];

const DOCUMENTS: Record<EdiSendEntityType, { transactionSet: string; relatedEntityType: string }> = {
  'sales-order': { transactionSet: '855', relatedEntityType: 'SalesOrder' },
  'shipment': { transactionSet: '856', relatedEntityType: 'Shipment' },
  'invoice': { transactionSet: '810', relatedEntityType: 'Invoice' },
};

/**
 * "Send EDI 855/856/810" for a sales order, shipment or invoice. Shown only with EDI on, to the roles the EDI
 * API admits, and when the customer has an active trading partner; it shows the last transaction sent for the
 * document (sent, acknowledged or error) with a link to the EDI log.
 */
@Component({
  selector: 'app-edi-send-action',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslatePipe],
  templateUrl: './edi-send-action.component.html',
  styleUrl: './edi-send-action.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdiSendActionComponent {
  private readonly edi = inject(EdiService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly entityType = input.required<EdiSendEntityType>();
  readonly entityId = input.required<number>();
  readonly customerId = input<number | null>(null);

  protected readonly partner = signal<EdiTradingPartner | null>(null);
  protected readonly lastTransaction = signal<EdiTransaction | null>(null);
  protected readonly sending = signal(false);

  protected readonly allowed = computed(() =>
    this.capabilities.isEnabled('CAP-CROSS-INTEG-EDI') && this.auth.hasAnyRole(SEND_ROLES));

  protected readonly transactionSet = computed(() => DOCUMENTS[this.entityType()].transactionSet);

  protected readonly outcome = computed<'acknowledged' | 'error' | 'sent' | null>(() => {
    const t = this.lastTransaction();
    if (!t) return null;
    if (t.status === 'Acknowledged' || t.isAcknowledged) return 'acknowledged';
    if (t.status === 'Error' || t.status === 'Rejected') return 'error';
    return 'sent';
  });

  constructor() {
    effect(() => {
      const allowed = this.allowed();
      const customerId = this.customerId();
      const entityId = this.entityId();
      untracked(() => {
        this.partner.set(null);
        this.lastTransaction.set(null);
        if (allowed && customerId != null && entityId) this.load(customerId);
      });
    });
  }

  private load(customerId: number): void {
    this.edi.getTradingPartners(true, customerId).subscribe({
      next: partners => {
        const partner = partners.find(p => p.isActive && p.customerId === customerId) ?? null;
        this.partner.set(partner);
        if (partner) this.loadLastTransaction();
      },
      error: () => this.partner.set(null),
    });
  }

  private loadLastTransaction(): void {
    const doc = DOCUMENTS[this.entityType()];
    this.edi.getTransactions({
      transactionSet: doc.transactionSet,
      relatedEntityType: doc.relatedEntityType,
      relatedEntityId: this.entityId(),
      pageSize: 1,
    }).subscribe({
      next: page => this.lastTransaction.set(page.data[0] ?? null),
      error: () => this.lastTransaction.set(null),
    });
  }

  protected send(): void {
    const partner = this.partner();
    if (!partner || this.sending()) return;
    this.sending.set(true);
    this.edi.sendOutbound(this.entityType(), this.entityId(), partner.id).subscribe({
      next: transaction => {
        this.sending.set(false);
        this.lastTransaction.set(transaction);
        if (transaction.status === 'Error') {
          this.snackbar.error(transaction.errorMessage ?? this.translate.instant('edi.send.failed'));
        } else {
          this.snackbar.success(this.translate.instant('edi.send.sent', { set: this.transactionSet(), partner: partner.name }));
        }
      },
      error: (err: unknown) => { this.sending.set(false); this.snackbar.errorFrom(err, 'edi.send.failed'); },
    });
  }
}
