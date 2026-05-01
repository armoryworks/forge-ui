import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { InventoryClass } from '../../models/inventory-class.type';
import { ProcurementSource } from '../../models/procurement-source.type';

/**
 * Pre-beta fork dialog mode pick — kept for callers that import the type.
 */
export type NewPartChoice = 'express' | 'guided';

/**
 * Pre-beta fork result. Replaces the old single-axis legacy `partType`
 * payload — the fork dialog now answers all four questions per the audit
 * (`phase-4-output/part-type-field-relevance.md` § 2):
 *
 *  1. ProcurementSource — Make / Buy / Subcontract / Phantom.
 *  2. InventoryClass — filtered to viable combos for the chosen source.
 *  3. ItemKindId — optional descriptive ref-data tag (Fastener, Electronic,
 *     etc.). Null when the user skips it.
 *  4. Mode — express (one form) vs guided (step-by-step).
 */
export interface NewPartForkResult {
  procurementSource: ProcurementSource;
  inventoryClass: InventoryClass;
  itemKindId: number | null;
  mode: NewPartChoice;
}

interface ProcurementChoice {
  value: ProcurementSource;
  titleKey: string;
  descKey: string;
  icon: string;
}

interface InventoryChoice {
  value: InventoryClass;
  titleKey: string;
  descKey: string;
}

/** Per-(procurement,inventory) combo metadata: recommended mode default. */
interface ComboMeta {
  procurement: ProcurementSource;
  inventoryClass: InventoryClass;
  defaultMode: NewPartChoice;
}

/**
 * Pre-beta — replaces the legacy single-axis 4-bucket fork dialog with a
 * proper axis-based picker per the audit (Section 2). The user answers four
 * questions — Procurement → InventoryClass (filtered) → ItemKind → Mode.
 *
 * Step 2's options are filtered to the 11 viable combos per the audit.
 * Phantom + Raw / Phantom + Consumable / Phantom + Component etc. don't
 * appear because the underlying workflow definitions for those combos don't
 * exist server-side; the filter is the enforcement point.
 */
@Component({
  selector: 'app-new-part-fork-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './new-part-fork-dialog.component.html',
  styleUrl: './new-part-fork-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewPartForkDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<NewPartForkDialogComponent, NewPartForkResult | undefined>);
  private readonly translate = inject(TranslateService);
  private readonly refData = inject(ReferenceDataService);

  /** Step 1 — picked procurement source. Null until the user picks. */
  protected readonly procurement = signal<ProcurementSource | null>(null);

  /** Step 2 — picked inventory class. Null until the user picks. */
  protected readonly inventoryClass = signal<InventoryClass | null>(null);

  /** Step 3 — optional item kind tag. Bound to the standalone FormControl. */
  protected readonly itemKindControl = new FormControl<number | null>(null);

  /**
   * Step 4 — explicit mode pick. Null until the user clicks one; falls back
   * to {@link recommendedMode} so we always have a value.
   */
  protected readonly modeOverride = signal<NewPartChoice | null>(null);

  protected readonly itemKindOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('parts.workflow.fork.step3None') },
  ]);

  protected readonly procurementChoices: readonly ProcurementChoice[] = [
    { value: 'Make', titleKey: 'parts.workflow.fork.step1Make', descKey: 'parts.workflow.fork.step1MakeDesc', icon: 'build' },
    { value: 'Buy', titleKey: 'parts.workflow.fork.step1Buy', descKey: 'parts.workflow.fork.step1BuyDesc', icon: 'shopping_cart' },
    { value: 'Subcontract', titleKey: 'parts.workflow.fork.step1Subcontract', descKey: 'parts.workflow.fork.step1SubcontractDesc', icon: 'handshake' },
    { value: 'Phantom', titleKey: 'parts.workflow.fork.step1Phantom', descKey: 'parts.workflow.fork.step1PhantomDesc', icon: 'category' },
  ];

  /**
   * Audit Section 5 — the 11 viable (procurement × inventory) combos with
   * their per-combo recommended mode default. The `available` lookup
   * filters Step 2 down to the Step-1-compatible inventory classes.
   *
   * Buy: Raw / Component / Subassembly / FinishedGood / Consumable / Tool
   * Make: Component / Subassembly / FinishedGood / Tool
   * Subcontract: Component / Subassembly
   * Phantom: Subassembly / FinishedGood
   */
  protected readonly viableCombos: readonly ComboMeta[] = [
    // Buy — most are express-recommended (single form, simple data shape)
    { procurement: 'Buy', inventoryClass: 'Raw', defaultMode: 'express' },
    { procurement: 'Buy', inventoryClass: 'Component', defaultMode: 'express' },
    { procurement: 'Buy', inventoryClass: 'Subassembly', defaultMode: 'guided' },
    { procurement: 'Buy', inventoryClass: 'FinishedGood', defaultMode: 'express' },
    { procurement: 'Buy', inventoryClass: 'Consumable', defaultMode: 'express' },
    { procurement: 'Buy', inventoryClass: 'Tool', defaultMode: 'express' },
    // Make — guided-recommended (BOM + routing always needed)
    { procurement: 'Make', inventoryClass: 'Component', defaultMode: 'guided' },
    { procurement: 'Make', inventoryClass: 'Subassembly', defaultMode: 'guided' },
    { procurement: 'Make', inventoryClass: 'FinishedGood', defaultMode: 'guided' },
    { procurement: 'Make', inventoryClass: 'Tool', defaultMode: 'guided' },
    // Subcontract — guided-recommended (vendor-side complexity)
    { procurement: 'Subcontract', inventoryClass: 'Component', defaultMode: 'guided' },
    { procurement: 'Subcontract', inventoryClass: 'Subassembly', defaultMode: 'guided' },
    // Phantom — express-recommended (logical grouping; nothing to schedule)
    { procurement: 'Phantom', inventoryClass: 'Subassembly', defaultMode: 'express' },
    { procurement: 'Phantom', inventoryClass: 'FinishedGood', defaultMode: 'express' },
  ];

  private readonly inventoryLabels: Record<InventoryClass, { titleKey: string; descKey: string }> = {
    Raw: { titleKey: 'parts.workflow.fork.step2Raw', descKey: 'parts.workflow.fork.step2RawDesc' },
    Component: { titleKey: 'parts.workflow.fork.step2Component', descKey: 'parts.workflow.fork.step2ComponentDesc' },
    Subassembly: { titleKey: 'parts.workflow.fork.step2Subassembly', descKey: 'parts.workflow.fork.step2SubassemblyDesc' },
    FinishedGood: { titleKey: 'parts.workflow.fork.step2FinishedGood', descKey: 'parts.workflow.fork.step2FinishedGoodDesc' },
    Consumable: { titleKey: 'parts.workflow.fork.step2Consumable', descKey: 'parts.workflow.fork.step2ConsumableDesc' },
    Tool: { titleKey: 'parts.workflow.fork.step2Tool', descKey: 'parts.workflow.fork.step2ToolDesc' },
  };

  /** Step 2's filtered choices, derived from the Step-1 pick. */
  protected readonly inventoryChoices = computed<InventoryChoice[]>(() => {
    const p = this.procurement();
    if (!p) return [];
    return this.viableCombos
      .filter(c => c.procurement === p)
      .map<InventoryChoice>(c => ({
        value: c.inventoryClass,
        titleKey: this.inventoryLabels[c.inventoryClass].titleKey,
        descKey: this.inventoryLabels[c.inventoryClass].descKey,
      }));
  });

  /** The mode the dialog recommends for the current (procurement, inventory) pair. */
  protected readonly recommendedMode = computed<NewPartChoice>(() => {
    const p = this.procurement();
    const i = this.inventoryClass();
    if (!p || !i) return 'express';
    return this.viableCombos.find(c => c.procurement === p && c.inventoryClass === i)?.defaultMode ?? 'express';
  });

  /** The mode currently rendered as "selected" — user override wins. */
  protected readonly effectiveMode = computed<NewPartChoice>(() => {
    return this.modeOverride() ?? this.recommendedMode();
  });

  /** Continue is enabled once Steps 1 + 2 are both picked. */
  protected readonly canContinue = computed<boolean>(() => {
    return this.procurement() !== null && this.inventoryClass() !== null;
  });

  protected readonly violations = computed<string[]>(() => {
    const list: string[] = [];
    if (this.procurement() === null) {
      list.push(this.translate.instant('parts.workflow.fork.violations.procurementRequired'));
    }
    if (this.inventoryClass() === null) {
      list.push(this.translate.instant('parts.workflow.fork.violations.inventoryClassRequired'));
    }
    return list;
  });

  ngOnInit(): void {
    // Optional kind tag — fallback to a "None" entry only if the load fails
    // or the ref-data group isn't seeded. The kind is never required.
    this.refData.getByGroup('part.item_kind').subscribe({
      next: (items) => {
        const opts: SelectOption[] = [
          { value: null, label: this.translate.instant('parts.workflow.fork.step3None') },
        ];
        for (const item of [...items].filter(i => i.isActive).sort((a, b) => a.sortOrder - b.sortOrder)) {
          opts.push({ value: item.id, label: item.label });
        }
        this.itemKindOptions.set(opts);
      },
    });
  }

  protected pickProcurement(p: ProcurementSource): void {
    this.procurement.set(p);
    // Clear downstream state so the user re-picks Step 2 against the new
    // filtered options.
    this.inventoryClass.set(null);
    this.modeOverride.set(null);
  }

  protected pickInventoryClass(c: InventoryClass): void {
    this.inventoryClass.set(c);
    // Don't clear the user's mode override — they may have already locked
    // in an explicit pick. The recommendedMode computed handles the
    // default-from-combo display.
  }

  protected pickMode(m: NewPartChoice): void {
    this.modeOverride.set(m);
  }

  protected continue(): void {
    const p = this.procurement();
    const i = this.inventoryClass();
    if (!p || !i) return;
    this.dialogRef.close({
      procurementSource: p,
      inventoryClass: i,
      itemKindId: this.itemKindControl.value ?? null,
      mode: this.effectiveMode(),
    });
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
