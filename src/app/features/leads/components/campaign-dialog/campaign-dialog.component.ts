import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { BulkLeadIntakeStrategy } from '../../models/bulk-intake.model';
import {
  CreateOutreachCampaignRequest,
  OutreachCampaign,
  UpdateOutreachCampaignRequest,
} from '../../models/campaign.model';

export interface CampaignDialogData {
  campaign?: OutreachCampaign;
}

export type CampaignDialogResult =
  | { mode: 'create'; request: CreateOutreachCampaignRequest }
  | { mode: 'update'; id: number; request: UpdateOutreachCampaignRequest };

@Component({
  selector: 'app-campaign-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    DatepickerComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './campaign-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CampaignDialogComponent, CampaignDialogResult | undefined>);
  private readonly data = inject<CampaignDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly translate = inject(TranslateService);

  protected readonly editing = !!this.data.campaign;

  protected readonly strategyOptions: SelectOption[] = [
    { value: 'ColdCall', label: this.translate.instant('leads.intake.strategy.coldCall') },
    { value: 'ColdEmail', label: this.translate.instant('leads.intake.strategy.coldEmail') },
    { value: 'TradeShowFollowup', label: this.translate.instant('leads.intake.strategy.tradeShow') },
    { value: 'WebinarAttendee', label: this.translate.instant('leads.intake.strategy.webinar') },
    { value: 'ListPurchase', label: this.translate.instant('leads.intake.strategy.listPurchase') },
    { value: 'ManualEntry', label: this.translate.instant('leads.intake.strategy.manual') },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl<string>(this.data.campaign?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    description: new FormControl<string>(this.data.campaign?.description ?? '', { nonNullable: true }),
    strategy: new FormControl<BulkLeadIntakeStrategy>(this.data.campaign?.strategy ?? 'ColdCall', { nonNullable: true }),
    defaultCooldownDays: new FormControl<number | null>(this.data.campaign?.defaultCooldownDays ?? null),
    startedAt: new FormControl<Date | null>(this.data.campaign?.startedAt ? new Date(this.data.campaign.startedAt) : null),
    endedAt: new FormControl<Date | null>(this.data.campaign?.endedAt ? new Date(this.data.campaign.endedAt) : null),
    isActive: new FormControl<boolean>(this.data.campaign?.isActive ?? true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('leads.campaigns.fieldName'),
  });

  protected readonly title = computed(() => this.translate.instant(
    this.editing ? 'leads.campaigns.editTitle' : 'leads.campaigns.createTitle',
  ));

  protected readonly saving = signal(false);

  protected confirm(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if (this.editing && this.data.campaign) {
      this.dialogRef.close({
        mode: 'update',
        id: this.data.campaign.id,
        request: {
          name: v.name.trim(),
          description: v.description.trim() || undefined,
          defaultCooldownDays: v.defaultCooldownDays ?? undefined,
          startedAt: v.startedAt ? toIsoDate(v.startedAt) ?? undefined : undefined,
          endedAt: v.endedAt ? toIsoDate(v.endedAt) ?? undefined : undefined,
          isActive: v.isActive,
        },
      });
    } else {
      this.dialogRef.close({
        mode: 'create',
        request: {
          name: v.name.trim(),
          description: v.description.trim() || undefined,
          strategy: v.strategy,
          defaultCooldownDays: v.defaultCooldownDays ?? undefined,
          startedAt: v.startedAt ? toIsoDate(v.startedAt) ?? undefined : undefined,
          endedAt: v.endedAt ? toIsoDate(v.endedAt) ?? undefined : undefined,
        },
      });
    }
  }

  protected close(): void { this.dialogRef.close(undefined); }
}
