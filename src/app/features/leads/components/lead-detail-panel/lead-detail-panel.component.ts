import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LeadsService } from '../../services/leads.service';
import { OutreachCampaignsService } from '../../services/outreach-campaigns.service';
import { LeadItem, CapabilityFitStatus, NdaState, ExportControlClearance } from '../../models/lead-item.model';
import { LeadStatus } from '../../models/lead-status.type';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { FileAttachment } from '../../../../shared/models/file.model';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { RecentCommunicationsComponent } from '../../../../shared/components/recent-communications/recent-communications.component';

@Component({
  selector: 'app-lead-detail-panel',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe, MatTooltipModule, MatMenuModule,
    DialogComponent, TextareaComponent, ValidationButtonComponent, EntityActivitySectionComponent,
    RecentCommunicationsComponent, FileUploadZoneComponent,
  ],
  templateUrl: './lead-detail-panel.component.html',
  styleUrl: './lead-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadDetailPanelComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly campaignsService = inject(OutreachCampaignsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly leadId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<LeadItem>();

  protected readonly lead = signal<LeadItem | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly documents = signal<FileAttachment[]>([]);
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
        this.loadDocuments(id);
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

  /**
   * Navigate to the campaigns list. We don't try to highlight a specific
   * row (the shared DataTable doesn't expose row anchors and per-row
   * detail navigation isn't a campaign concept) — landing on the list
   * with the campaign name visible is the useful outcome.
   * `campaignId` param signature kept for future deep-link support.
   */
  protected openCampaign(_campaignId: number): void {
    this.router.navigate(['/leads/campaigns']);
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

  // Per-chip pending markers so the template can dim the chip while the
  // PATCH is in flight. Three separate signals so concurrent chip edits
  // don't fight each other.
  protected readonly capFitPending = signal(false);
  protected readonly ndaPending = signal(false);
  protected readonly exportPending = signal(false);

  protected setCapabilityFit(value: CapabilityFitStatus): void {
    const lead = this.lead();
    if (!lead || lead.capabilityFit === value) return;
    this.capFitPending.set(true);
    this.leadsService.updateLead(lead.id, { capabilityFit: value }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.snackbar.success(this.translate.instant('leads.classification.capabilityFitUpdated', { state: this.translate.instant('leads.classification.capFit.' + value) }));
        this.capFitPending.set(false);
      },
      error: () => this.capFitPending.set(false),
    });
  }

  protected setNdaState(value: NdaState): void {
    const lead = this.lead();
    if (!lead || lead.ndaState === value) return;
    this.ndaPending.set(true);
    this.leadsService.updateLead(lead.id, { ndaState: value }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.snackbar.success(this.translate.instant('leads.classification.ndaUpdated', { state: this.translate.instant('leads.classification.nda.' + value) }));
        this.ndaPending.set(false);
      },
      error: () => this.ndaPending.set(false),
    });
  }

  protected setExportControl(value: ExportControlClearance): void {
    const lead = this.lead();
    if (!lead || lead.exportControl === value) return;
    this.exportPending.set(true);
    this.leadsService.updateLead(lead.id, { exportControl: value }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.snackbar.success(this.translate.instant('leads.classification.exportControlUpdated', { state: this.translate.instant('leads.classification.export.' + value) }));
        this.exportPending.set(false);
      },
      error: () => this.exportPending.set(false),
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

  // Which status button is currently mid-PATCH. Disables the button + shows
  // a spinner on it; on success the chip color updates via the refreshed
  // lead signal. We optimistically set the lead's status before the PATCH
  // completes so the chip flips immediately; on error we revert.
  protected readonly statusPending = signal<LeadStatus | null>(null);

  protected updateStatus(status: LeadStatus): void {
    const lead = this.lead();
    if (!lead) return;

    if (status === 'Lost') {
      this.showLostDialog.set(true);
      return;
    }

    // Optimistic update — flip the chip immediately so the rep gets
    // feedback. Stash the previous status so we can revert on failure.
    const previous = lead.status;
    this.lead.set({ ...lead, status });
    this.statusPending.set(status);

    this.leadsService.updateLead(lead.id, { status }).subscribe({
      next: (updated) => {
        this.lead.set(updated);
        this.statusPending.set(null);
        this.snackbar.success(this.translate.instant('leads.statusUpdated', {
          status: this.translate.instant('leads.statuses.' + status),
        }));
      },
      error: () => {
        // Revert the optimistic flip — the chip goes back to the prior
        // status. The global HTTP-error interceptor already surfaces the
        // failure toast so we don't need a second message here.
        this.lead.set({ ...lead, status: previous });
        this.statusPending.set(null);
      },
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

  // --- Documents (mirrors the sales-order detail panel's Documents tab) ---

  private loadDocuments(id: number): void {
    this.leadsService.getDocuments(id).subscribe({
      next: (docs) => this.documents.set(docs),
    });
  }

  protected downloadFile(doc: FileAttachment): void {
    window.open(this.leadsService.downloadFileUrl(doc.id), '_blank');
  }

  protected deleteFile(doc: FileAttachment): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('leads.deleteFileTitle'),
        message: this.translate.instant('leads.deleteFileMessage', { name: doc.fileName }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.leadsService.deleteFile(doc.id).subscribe({
        next: () => {
          this.documents.update(list => list.filter(f => f.id !== doc.id));
          this.snackbar.success(this.translate.instant('leads.fileDeleted'));
        },
      });
    });
  }

  protected onFileUploaded(_file: UploadedFile): void {
    this.loadDocuments(this.leadId());
    this.snackbar.success(this.translate.instant('leads.fileUploaded'));
  }

  protected getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'table_chart';
    if (contentType.includes('document') || contentType.includes('word')) return 'description';
    return 'attach_file';
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * One-click lead conversion (2026-05-31, see CLAUDE.md "Guided Wizards"
   * section). The legacy multi-step convert dialog was retired alongside
   * the vendor + customer wizard migrations: convertLead has always been
   * an atomic server operation (creates Customer, links Lead, rolls
   * forward AccountContacts + outreach preferences in one SaveChanges),
   * so the mat-stepper that wrapped it was UX scaffolding, not a
   * technical necessity. The credit/tax/address fields that used to live
   * in the dialog now move to the customer detail page after conversion.
   * Click → POST with empty body → navigate to the new customer.
   */
  protected convertLead(): void {
    const lead = this.lead();
    if (!lead) return;

    this.saving.set(true);
    this.leadsService.convertLead(lead.id, { createJob: false }).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('leads.convertedOnly'));
        if (result.customerId) {
          this.router.navigate(['/customers', result.customerId, 'overview']);
        } else {
          this.loadLead(lead.id);
        }
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('leads.convertFailed'));
      },
    });
  }
}
