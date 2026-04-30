import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { PartType } from '../../models/part-type.type';

/**
 * The user's mode pick — preserved name from Phase 5 so callers that still
 * import {@link NewPartChoice} keep compiling. Phase 6 added a sibling
 * payload type ({@link NewPartForkResult}) that wraps both the part type
 * (Q1) and the mode (Q2).
 */
export type NewPartChoice = 'express' | 'guided';

/**
 * Two-question fork result emitted by the dialog when the user clicks
 * Continue. Phase 6 added the type-aware Q1; the mode (Q2) is the same
 * choice Phase 5 already exposed.
 *
 * - `partType` — the part-type discriminator written to the new entity's
 *   `type` field on creation.
 * - `mode` — the workflow presentation choice ('express' or 'guided').
 */
export interface NewPartForkResult {
  partType: PartType;
  mode: NewPartChoice;
}

/**
 * The Q1 UI bucket. `Other` is a UI-only collapse of every PartType that
 * isn't called out as a headline option (Consumable / Tooling / Fastener /
 * Electronic / Packaging) — kept simple at the dialog tier, expanded to a
 * concrete `PartType` when the dialog closes (see `continue`).
 */
type PartTypeBucket = 'Assembly' | 'RawMaterial' | 'Part' | 'Other';

interface PartTypeChoice {
  /** UI-tier bucket; not the wire-level enum (see `continue`). */
  value: PartTypeBucket;
  /** i18n key for the card title. */
  titleKey: string;
  /** i18n key for the card description. */
  descKey: string;
  /** Material Icons Outlined icon name. */
  icon: string;
  /** Default mode for this part type per the design doc D3. */
  defaultMode: NewPartChoice;
}

/**
 * Workflow Pattern Phase 6 — "How would you like to add this part?" fork
 * shown when the user clicks New Part on the list page. Two questions:
 *   • Q1 (part type) — Assembly, Raw Material, Made Part, Other.
 *   • Q2 (mode) — Express (one form) vs Step-by-step (guided wizard).
 *
 * Q2 defaults from Q1 per the design doc D3:
 *   - Raw Material → Express (default)
 *   - Assembly → Step-by-step (default)
 *   - All other types → Express (default; raw-material's simpler model is
 *     the safer default for unknown until type-specific workflows exist).
 *
 * The user can override the default. Q1's default presents the matched
 * Q2 default live (re-renders on every Q1 click) so the user sees the
 * recommendation update immediately — but the user's explicit Q2 click
 * is sticky once they've made one (we don't override their choice on
 * subsequent Q1 clicks).
 *
 * The dialog routes to the right downstream UI: the picked partType is
 * passed to the workflow's `initialEntityData`, and the mode picks which
 * workflow definition to start (see `workflowDefinitionForPartType` in
 * `parts.component.ts`).
 */
@Component({
  selector: 'app-new-part-fork-dialog',
  standalone: true,
  imports: [TranslatePipe, DialogComponent, ValidationButtonComponent],
  templateUrl: './new-part-fork-dialog.component.html',
  styleUrl: './new-part-fork-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewPartForkDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<NewPartForkDialogComponent, NewPartForkResult | undefined>);
  private readonly translate = inject(TranslateService);

  /** Q1 — currently picked part-type bucket. Null until the user picks. */
  protected readonly partType = signal<PartTypeBucket | null>(null);

  /**
   * Q2 — currently picked mode. Null until the user explicitly clicks one.
   * When null, the rendered "selected" mode is computed from the partType's
   * default (per D3). Once non-null, the user's pick is sticky across Q1
   * re-clicks.
   */
  protected readonly modeOverride = signal<NewPartChoice | null>(null);

  protected readonly partTypeChoices: readonly PartTypeChoice[] = [
    {
      value: 'Assembly',
      titleKey: 'parts.workflow.fork.partType.assemblyTitle',
      descKey: 'parts.workflow.fork.partType.assemblyDesc',
      icon: 'category',
      defaultMode: 'guided',
    },
    {
      value: 'RawMaterial',
      titleKey: 'parts.workflow.fork.partType.rawMaterialTitle',
      descKey: 'parts.workflow.fork.partType.rawMaterialDesc',
      icon: 'inventory_2',
      defaultMode: 'express',
    },
    {
      value: 'Part',
      titleKey: 'parts.workflow.fork.partType.madeTitle',
      descKey: 'parts.workflow.fork.partType.madeDesc',
      icon: 'build',
      defaultMode: 'express',
    },
    {
      value: 'Other',
      titleKey: 'parts.workflow.fork.partType.otherTitle',
      descKey: 'parts.workflow.fork.partType.otherDesc',
      icon: 'more_horiz',
      defaultMode: 'express',
    },
  ];

  /**
   * The Q2 default the user would see if they don't click Q2 explicitly.
   * Falls back to 'express' until Q1 is picked (matches the D3 "default
   * for unknown" rule). Note: `Other` covers any non-headline part type
   * (Consumable / Tooling / Fastener / Electronic / Packaging) — those
   * route to the same raw-material workflow until their own workflows
   * ship in later phases.
   */
  protected readonly defaultMode = computed<NewPartChoice>(() => {
    const t = this.partType();
    if (!t) return 'express';
    return this.partTypeChoices.find(c => c.value === t)?.defaultMode ?? 'express';
  });

  /** The mode currently rendered as "selected" — user override wins over default. */
  protected readonly effectiveMode = computed<NewPartChoice>(() => {
    return this.modeOverride() ?? this.defaultMode();
  });

  /** Continue is enabled once Q1 is picked (Q2 always has a default). */
  protected readonly canContinue = computed<boolean>(() => this.partType() !== null);

  /**
   * Signal-derived violations list for the `<app-validation-button>` stereotype.
   * The dialog uses signal-based state instead of a FormGroup, so we compute
   * the message list directly rather than via FormValidationService. Q2 always
   * has a default — only Q1 can be missing.
   */
  protected readonly violations = computed<string[]>(() => {
    const list: string[] = [];
    if (this.partType() === null) {
      list.push(this.translate.instant('parts.workflow.fork.violations.partTypeRequired'));
    }
    return list;
  });

  protected pickPartType(t: PartTypeBucket): void {
    this.partType.set(t);
  }

  protected pickMode(m: NewPartChoice): void {
    this.modeOverride.set(m);
  }

  protected continue(): void {
    const t = this.partType();
    if (!t) return;
    // The 'Other' UI bucket maps to 'Consumable' on the wire — gives the
    // server a concrete enum value while keeping the Q1 UI simple.
    const wireType: PartType = t === 'Other' ? 'Consumable' : t;
    this.dialogRef.close({ partType: wireType, mode: this.effectiveMode() });
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
