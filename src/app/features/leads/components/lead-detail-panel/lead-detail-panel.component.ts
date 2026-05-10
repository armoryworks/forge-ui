import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LeadsService } from '../../services/leads.service';
import { OutreachCampaignsService } from '../../services/outreach-campaigns.service';
import { LeadItem, CapabilityFitStatus, NdaState, ExportControlClearance } from '../../models/lead-item.model';
import { LeadStatus } from '../../models/lead-status.type';
import { ConvertLeadRequest } from '../../models/convert-lead-request.model';
import { LeadConvertDialogComponent, LeadConvertDialogData } from '../lead-convert-dialog/lead-convert-dialog.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { RecentCommunicationsComponent } from '../../../../shared/components/recent-communications/recent-communications.component';

@Component({
  selector: 'app-lead-detail-panel',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe, MatTooltipModule, MatMenuModule,
    DialogComponent, TextareaComponent, ValidationButtonComponent, EntityActivitySectionComponent,
    RecentCommunicationsComponent,
  ],
  templateUrl: './lead-detail-panel.component.html',
  styleUrl: './lead-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadDetailPanelComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly campaignsService = inject(OutreachCampaignsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly leadId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<LeadItem>();

  protected readonly lead = signal<LeadItem | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  /** Phase 1r — campaign name lookup. Loaded lazily; falls back to "Campaign #N". */
  protected readonly campaignNames = signal<Map<number, string>>(new Map());

  protected readonly capabilityFitOptions: CapabilityFitStatus[] = ['NotAssessed', 'Fits', 'NeedsReview', 'DoesntFit'];
  protected readonly ndaStateOptions: NdaState[] = ['None', 'Requested', 'InForce', 'Expired'];
  protected readonly exportControlOptions: ExportControlClearance[] = ['NotApplicable', 'Pending', 'Cleared', 'Denied'];

  // Lost reason dialog. Reason required + validation-button stereotype on
  // submit so a salesperson can't drop a lead without recording why.
  protected readonly showLostDialog = signal(false);
  protected readonly lostReasonControl = new FormControl('', [Validators.required, Validators.maxLength(500)]);
  protected readonly lostFormGroup = new FormGroup({ reason: this.lostReasonControl });
  protected readonly lostViolations = FormValidationService.getViolations(this.lostFormGroup, {
    reason: this.translate.instant('leads.reason'),
  });

  protected readonly statuses: LeadStatus[] = ['New', 'Contacted', 'Quoting', 'Converted', 'Lost'];

  constructor() {
    effect(() => {
      const id = this.leadId();
      if (id) {
        this.loadLead(id);
      }
    });

    effect(() => {
      const campaignId = this.lead()?.campaignId;
      if (campaignId && !this.campaignNames().has(campaignId)) {
        this.loadCampaignNames();
      }
    });
  }

  private loadLead(id: number): void {
    this.loading.set(true);
    this.leadsService.getLeadById(id).subscribe({
      next: (lead) => { this.lead.set(lead); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadCampaignNames(): void {
    this.campaignsService.list().subscribe({
      next: (campaigns) => {
        const map = new Map<number, string>();
        for (const c of campaigns) map.set(c.id, c.name);
        this.campaignNames.set(map);
      },
    });
  }

  protected getCampaignName(campaignId: number): string {
    return this.campaignNames().get(campaignId) ?? this.translate.instant('leads.campaignFallback', { id: campaignId });
  }

  protected getCapabilityFitClass(value: CapabilityFitStatus | undefined): string {
    const map: Record<CapabilityFitStatus, string> = {
      NotAssessed: 'chip--muted', Fits: 'chip--success',
      NeedsReview: 'chip--warning', DoesntFit: 'chip--error',
    };
    return `chip ${value ? map[value] : 'chip--muted'}`;
  }

  protected getNdaStateClass(value: NdaState | undefined): string {
    const map: Record<NdaState, string> = {
      None: 'chip--muted', Requested: 'chip--info',
      InForce: 'chip--success', Expired: 'chip--warning',
    };
    return `chip ${value ? map[value] : 'chip--muted'}`;
  }

  protected getExportControlClass(value: ExportControlClearance | undefined): string {
    const map: Record<ExportControlClearance, string> = {
      NotApplicable: 'chip--muted', Pending: 'chip--warning',
      Cleared: 'chip--success', Denied: 'chip--error',
    };
    return `chip ${value ? map[value] : 'chip--muted'}`;
  }

  protected setCapabilityFit(value: CapabilityFitStatus): void {
    const lead = this.lead();
    if (!lead || lead.capabilityFit === value) return;
    this.leadsService.updateLead(lead.id, { capabilityFit: value }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.snackbar.success(this.translate.instant('leads.classification.capabilityFitUpdated', { state: this.translate.instant('leads.classification.capFit.' + value) }));
      },
    });
  }

  protected setNdaState(value: NdaState): void {
    const lead = this.lead();
    if (!lead || lead.ndaState === value) return;
    this.leadsService.updateLead(lead.id, { ndaState: value }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.snackbar.success(this.translate.instant('leads.classification.ndaUpdated', { state: this.translate.instant('leads.classification.nda.' + value) }));
      },
    });
  }

  protected setExportControl(value: ExportControlClearance): void {
    const lead = this.lead();
    if (!lead || lead.exportControl === value) return;
    this.leadsService.updateLead(lead.id, { exportControl: value }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.snackbar.success(this.translate.instant('leads.classification.exportControlUpdated', { state: this.translate.instant('leads.classification.export.' + value) }));
      },
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      New: 'chip--primary', Contacted: 'chip--info', Quoting: 'chip--warning',
      Converted: 'chip--success', Lost: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected isFollowUpOverdue(lead: LeadItem): boolean {
    if (!lead.followUpDate) return false;
    const d = lead.followUpDate instanceof Date ? lead.followUpDate : new Date(lead.followUpDate as unknown as string);
    return d.getTime() < new Date().getTime();
  }

  /**
   * Phase 1j.3 — per-shape next-action hint. The engagement shape implies
   * a sales motion; the hint nudges reps toward the right next step
   * without prescribing a hard process. Static map for v1; admin-
   * customizable copy is a follow-on (would land in reference_data).
   */
  protected getShapePlaybook(shape: string): string {
    return this.translate.instant('leads.playbook.' + shape);
  }

  protected getShapeIcon(shape: string): string {
    const map: Record<string, string> = {
      QuickQuote: 'request_quote',
      Repeat: 'repeat',
      Strategic: 'business_center',
      Prototype: 'science',
      Unknown: 'flash_on',
    };
    return map[shape] ?? 'flag';
  }

  protected updateStatus(status: LeadStatus): void {
    const lead = this.lead();
    if (!lead) return;

    if (status === 'Lost') {
      this.showLostDialog.set(true);
      return;
    }

    this.leadsService.updateLead(lead.id, { status }).subscribe({
      next: (updated) => { this.lead.set(updated); },
    });
  }

  protected confirmLost(): void {
    const lead = this.lead();
    if (!lead) return;
    this.leadsService.updateLead(lead.id, {
      status: 'Lost',
      lostReason: this.lostReasonControl.value || undefined,
    }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.showLostDialog.set(false);
        this.lostReasonControl.setValue('');
      },
    });
  }

  protected openEditLead(): void {
    const lead = this.lead();
    if (!lead) return;
    this.editRequested.emit(lead);
  }

  protected convertLead(): void {
    const lead = this.lead();
    if (!lead) return;

    this.dialog.open<
      LeadConvertDialogComponent, LeadConvertDialogData, ConvertLeadRequest | undefined
    >(LeadConvertDialogComponent, {
      width: '640px',
      data: { lead } satisfies LeadConvertDialogData,
    }).afterClosed().subscribe(request => {
      if (!request) return;
      this.executeConversion(lead.id, request);
    });
  }

  private executeConversion(leadId: number, request: ConvertLeadRequest): void {
    this.saving.set(true);
    this.leadsService.convertLead(leadId, request).subscribe({
      next: () => {
        this.saving.set(false);
        const msg = request.createJob
          ? this.translate.instant('leads.convertedWithJob')
          : this.translate.instant('leads.convertedOnly');
        this.snackbar.success(msg);
        this.loadLead(leadId);
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('leads.convertFailed'));
      },
    });
  }
}
