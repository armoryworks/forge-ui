import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { toIsoDate, todayStart } from '../../../../shared/utils/date.utils';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { CreateLeadRequest } from '../../models/create-lead-request.model';
import { LeadEngagementShape } from '../../models/lead-engagement-shape.type';
import { AccountsService } from '../../services/accounts.service';
import { Account } from '../../models/account.model';

interface ShapeChoice {
  value: LeadEngagementShape;
  titleKey: string;
  descKey: string;
  icon: string;
}

/**
 * Wave 7 — New Lead fork dialog.
 *
 * Replaces the prior flat `+ New Lead` dialog with a 2-step axis-driven
 * flow that mirrors the Parts new-part fork pattern. Step 1 picks the
 * engagement shape (5 cards: Quick add / Quick quote / Repeat /
 * Strategic / Prototype). Step 2 surfaces the lead form with shape-
 * specific extra fields revealed conditionally.
 *
 * "Quick add" remains the easiest up-front path — picks Unknown,
 * lands on a flat 7-field form (matches today's behavior). The other
 * shapes surface 1-3 extra fields tailored to the sales motion they
 * imply, captured in the existing `Lead.CustomFieldValues` JSONB so
 * adding new shapes never requires schema work.
 *
 * Returns the populated CreateLeadRequest on commit, or undefined on
 * cancel. Caller routes the payload to LeadsService.createLead.
 */
@Component({
  selector: 'app-new-lead-fork-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent,
    InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './new-lead-fork-dialog.component.html',
  styleUrl: './new-lead-fork-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewLeadForkDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewLeadForkDialogComponent, CreateLeadRequest | undefined>);
  protected readonly translate = inject(TranslateService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly accountsService = inject(AccountsService);

  protected readonly currentStep = signal(0);
  protected readonly shape = signal<LeadEngagementShape>('Unknown');
  // Hook into the shared DraftService via app-dialog's [draftConfig].
  // entityId is 'fork-new' so it doesn't collide with the edit-lead
  // dialog's 'lead:{id}' key. The form's shape-specific extras live
  // inside `extras` so they round-trip through the same auto-save.
  protected readonly draftConfig: DraftConfig = { entityType: 'lead', entityId: 'fork-new', route: '/leads' };
  /** Phase 1l — follow-up + RFQ-due dates can't be in the past. */
  protected readonly today = todayStart();
  protected readonly sourceOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('common.none') },
  ]);
  // Phase 1r — optional account link at intake. Loaded once on construction;
  // null option leads the list so reps can leave the lead unaffiliated.
  protected readonly accountOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('leads.accounts.noneOption') },
  ]);

  // Form. Always-visible fields land directly on top-level controls;
  // shape-specific fields are nested under `extras` so the JSON
  // serialisation for CustomFieldValues is one operation. Conditional
  // validation lives in `setShapeRequiredness` — a shape pick can
  // mark a field required (e.g. Strategic → decisionMaker required)
  // when the team's intake convention demands it. Today no extras are
  // required; expand as the team's convention firms up.
  protected readonly form = new FormGroup({
    companyName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    contactName: new FormControl<string>('', { nonNullable: true }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email] }),
    phone: new FormControl<string>('', { nonNullable: true }),
    source: new FormControl<string | null>(null),
    accountId: new FormControl<number | null>(null),
    notes: new FormControl<string>('', { nonNullable: true }),
    followUpDate: new FormControl<Date | null>(null),
    extras: new FormGroup({
      // QuickQuote / Prototype
      rfqParts: new FormControl<string>('', { nonNullable: true }),
      rfqTargetPrice: new FormControl<string>('', { nonNullable: true }),
      rfqDueDate: new FormControl<Date | null>(null),
      // Strategic
      decisionMaker: new FormControl<string>('', { nonNullable: true }),
      champion: new FormControl<string>('', { nonNullable: true }),
      currentVendor: new FormControl<string>('', { nonNullable: true }),
      // Repeat
      referenceJob: new FormControl<string>('', { nonNullable: true }),
      // Prototype
      projectType: new FormControl<string>('', { nonNullable: true }),
      expectedTimeline: new FormControl<string>('', { nonNullable: true }),
    }),
  });

  protected readonly shapeChoices: readonly ShapeChoice[] = [
    { value: 'Unknown', titleKey: 'leads.fork.shapeUnknown', descKey: 'leads.fork.shapeUnknownDesc', icon: 'flash_on' },
    { value: 'QuickQuote', titleKey: 'leads.fork.shapeQuickQuote', descKey: 'leads.fork.shapeQuickQuoteDesc', icon: 'request_quote' },
    { value: 'Repeat', titleKey: 'leads.fork.shapeRepeat', descKey: 'leads.fork.shapeRepeatDesc', icon: 'repeat' },
    { value: 'Strategic', titleKey: 'leads.fork.shapeStrategic', descKey: 'leads.fork.shapeStrategicDesc', icon: 'business_center' },
    { value: 'Prototype', titleKey: 'leads.fork.shapePrototype', descKey: 'leads.fork.shapePrototypeDesc', icon: 'science' },
  ];

  protected readonly violations = FormValidationService.getViolations(this.form, {
    companyName: this.translate.instant('leads.companyName'),
    email: this.translate.instant('common.email'),
  });

  /** Whether the current shape pick reveals RFQ-style fields (parts list, target price, due date). */
  protected readonly showsRfqFields = computed(() => {
    const s = this.shape();
    return s === 'QuickQuote' || s === 'Prototype';
  });

  /** Whether the current shape pick reveals strategic-account fields (decision maker, champion, current vendor). */
  protected readonly showsStrategicFields = computed(() => this.shape() === 'Strategic');

  /** Whether the current shape pick reveals the reference-job field (Repeat). */
  protected readonly showsReferenceJob = computed(() => this.shape() === 'Repeat');

  /** Whether the current shape pick reveals prototype-specific fields (project type, expected timeline). */
  protected readonly showsPrototypeFields = computed(() => this.shape() === 'Prototype');

  constructor() {
    // Source options come from ref-data the same way the legacy create
    // dialog populated them — reused for parity (the team's existing
    // source taxonomy applies regardless of shape).
    this.refDataService.getAsOptions('lead_source', {
      allLabel: this.translate.instant('common.none'),
      valueField: 'label',
    }).subscribe(opts => this.sourceOptions.set(opts));

    // Lazy-load Accounts so the picker has options once Step 2 lands.
    // Empty install with no accounts → picker shows only the "— None —"
    // option, which is the right "no account yet" UX.
    this.accountsService.list().subscribe({
      next: (accounts: Account[]) => this.accountOptions.set([
        { value: null, label: this.translate.instant('leads.accounts.noneOption') },
        ...accounts.map(a => ({ value: a.id, label: a.name })),
      ]),
    });
  }

  protected pickShape(s: LeadEngagementShape): void {
    this.shape.set(s);
    this.currentStep.set(1);
  }

  protected back(): void { this.currentStep.set(0); }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  protected create(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const e = v.extras;

    // Build CustomFieldValues JSON only with fields that the picked
    // shape surfaces AND the user actually filled. Empty-string treated
    // as not-filled to keep the JSONB tidy.
    const custom: Record<string, string> = {};
    if (this.showsRfqFields()) {
      if (e.rfqParts.trim()) custom['rfqParts'] = e.rfqParts.trim();
      if (e.rfqTargetPrice.trim()) custom['rfqTargetPrice'] = e.rfqTargetPrice.trim();
      if (e.rfqDueDate) {
        const iso = toIsoDate(e.rfqDueDate);
        if (iso) custom['rfqDueDate'] = iso;
      }
    }
    if (this.showsStrategicFields()) {
      if (e.decisionMaker.trim()) custom['decisionMaker'] = e.decisionMaker.trim();
      if (e.champion.trim()) custom['champion'] = e.champion.trim();
      if (e.currentVendor.trim()) custom['currentVendor'] = e.currentVendor.trim();
    }
    if (this.showsReferenceJob()) {
      if (e.referenceJob.trim()) custom['referenceJob'] = e.referenceJob.trim();
    }
    if (this.showsPrototypeFields()) {
      if (e.projectType.trim()) custom['projectType'] = e.projectType.trim();
      if (e.expectedTimeline.trim()) custom['expectedTimeline'] = e.expectedTimeline.trim();
    }

    const request: CreateLeadRequest = {
      companyName: v.companyName,
      contactName: v.contactName.trim() || undefined,
      email: v.email.trim() || undefined,
      phone: v.phone.trim() || undefined,
      source: v.source ?? undefined,
      notes: v.notes.trim() || undefined,
      followUpDate: toIsoDate(v.followUpDate) ?? undefined,
      engagementShape: this.shape(),
      customFieldValues: Object.keys(custom).length > 0 ? JSON.stringify(custom) : undefined,
      accountId: v.accountId,
    };

    this.dialogRef.close(request);
  }
}
