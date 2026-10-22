import {
  afterNextRender, ChangeDetectionStrategy, Component, contentChildren, DestroyRef, DOCUMENT, ElementRef, HostListener, inject, input,
  OnInit, output, signal, viewChild,
} from '@angular/core';
import { ControlContainer, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

import { FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { DirtyFormIndicatorComponent } from '../dirty-form-indicator/dirty-form-indicator.component';
import { DraftRecoveryBannerComponent } from '../draft-recovery-banner/draft-recovery-banner.component';
import { DraftService } from '../../services/draft.service';
import { DraftConfig } from '../../models/draft-config.model';
import { DialogEscapeService, DialogEscapeTarget } from '../../services/dialog-escape.service';

const FIELD_OVERLAY_PANELS = '.mat-mdc-select-panel, .mat-mdc-autocomplete-panel.mat-mdc-autocomplete-visible, .mat-datepicker-content';
const FOCUS_CANDIDATES = 'input, select, textarea, button, a[href], [tabindex], [contenteditable="true"]';
const FORM_FIELDS = 'input, select, textarea, [contenteditable="true"], .mat-mdc-select';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe, DirtyFormIndicatorComponent, DraftRecoveryBannerComponent],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly draftService = inject(DraftService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly escapeService = inject(DialogEscapeService);
  private readonly focusTrapFactory = inject(FocusTrapFactory);
  private readonly interactivity = inject(InteractivityChecker);
  private readonly hostElement: HTMLElement = inject(ElementRef).nativeElement;
  private readonly hostMatDialogRef = inject(MatDialogRef, { optional: true });

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly closeButton = viewChild.required<ElementRef<HTMLElement>>('closeButton');
  private readonly formContainers = contentChildren(ControlContainer, { descendants: true });

  readonly title = input.required<string>();
  readonly width = input<string>('420px');
  readonly splitLayout = input<boolean>(false);
  /** Unsaved-changes flag. When left unbound, any dirty form inside the dialog counts. */
  readonly dirty = input<boolean | undefined>(undefined);
  readonly closed = output<void>();

  /** Optional draft config — when provided with draftFormGroup, enables auto-save/recovery. The draft is discarded when the dialog closes outside a route navigation. */
  readonly draftConfig = input<DraftConfig | null>(null);
  /** The FormGroup to auto-save. Required when draftConfig is set. */
  readonly draftFormGroup = input<FormGroup | null>(null);

  protected readonly restoredDraftTimestamp = signal<number | null>(null);
  protected readonly isDraftEnabled = signal(false);

  private escapeOwnedByFieldOverlay = false;
  private readonly dirtyAtOpen = new Map<ControlContainer, string>();

  constructor() {
    const snapshotFieldOverlay = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') this.escapeOwnedByFieldOverlay = this.hasOpenFieldOverlay();
    };
    this.document.addEventListener('keydown', snapshotFieldOverlay, true);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('keydown', snapshotFieldOverlay, true));

    const unregister = this.escapeService.register(this.escapeTarget);
    this.destroyRef.onDestroy(unregister);

    afterNextRender(() => this.takeFocus());
  }

  ngOnInit(): void {
    const config = this.draftConfig();
    const formGroup = this.draftFormGroup();
    if (!config || !formGroup) return;

    this.isDraftEnabled.set(true);

    // Build a DraftableForm adapter for the DraftService
    const adapter = this.buildAdapter(config, formGroup);

    // Load existing draft
    this.draftService.loadDraft(config.entityType, config.entityId).then(draft => {
      if (draft) {
        if (config.restoreFn) {
          config.restoreFn(draft.formData);
        } else {
          formGroup.patchValue(draft.formData);
        }
        formGroup.markAsDirty();
        this.restoredDraftTimestamp.set(draft.lastModified);
      }
    });

    // Register for auto-save
    this.draftService.register(adapter);

    // Unregister on destroy (dialog close / component teardown)
    this.destroyRef.onDestroy(() => {
      this.draftService.unregister(config.entityType, config.entityId);
      if (!this.router.currentNavigation()) {
        this.draftService.clearDraft(config.entityType, config.entityId);
      }
    });
  }

  /** Call from parent component after successful save to clear the draft. */
  clearDraft(): void {
    const config = this.draftConfig();
    if (config) {
      this.draftService.clearDraftAndBroadcastSave(config.entityType, config.entityId);
    }
  }

  protected discardDraft(): void {
    const config = this.draftConfig();
    if (config) {
      this.draftService.clearDraft(config.entityType, config.entityId);
    }
    this.restoredDraftTimestamp.set(null);
  }

  protected isDirty(): boolean {
    const config = this.draftConfig();
    if (config && this.draftFormGroup()) {
      return this.draftFormGroup()!.dirty;
    }
    return this.dirty() ?? this.formContainers().some(container => this.changedSinceOpen(container));
  }

  /**
   * Escape closes the dialog through the same path as the X button (incl. the
   * unsaved-changes confirm). This handler covers the inline usage while no
   * MatDialog is open, and only the innermost of nested inline dialogs closes.
   * Inside a MatDialog, {@link DialogEscapeService} routes Escape to the
   * topmost dialog instead. An open select, autocomplete or datepicker panel
   * owns Escape: that press closes the panel, not the form.
   */
  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.hostMatDialogRef || this.dialog.openDialogs.length > 0) return;
    if (!this.escapeService.isTopmost(this.escapeTarget)) return;
    if (this.escapeOwnedByFieldOverlay) return;
    this.tryClose();
  }

  tryClose(): void {
    this.escapeService.closeUnlessDirty(this.isDirty(), () => this.closed.emit());
  }

  private readonly escapeTarget: DialogEscapeTarget = {
    hostRef: this.hostMatDialogRef as MatDialogRef<unknown, unknown> | null,
    tryClose: () => this.tryClose(),
  };

  private takeFocus(): void {
    for (const container of this.formContainers()) {
      if (container.dirty) this.dirtyAtOpen.set(container, JSON.stringify(container.value));
    }

    const panel = this.panel().nativeElement;
    const target = this.initialFocusTarget(panel);

    if (this.isMatDialogShell()) {
      if (!target) return;
      target.setAttribute('cdkFocusInitial', '');
      if (this.document.activeElement === this.closeButton().nativeElement) target.focus();
      return;
    }

    const opener = this.document.activeElement;
    const trap = this.focusTrapFactory.create(panel);
    if (target) {
      target.focus();
    } else {
      trap.focusFirstTabbableElement();
    }
    this.destroyRef.onDestroy(() => {
      trap.destroy();
      const active = this.document.activeElement;
      const focusLost = !active || active === this.document.body || panel.contains(active);
      if (focusLost && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    });
  }

  private changedSinceOpen(container: ControlContainer): boolean {
    if (!container.dirty) return false;
    const valueAtOpen = this.dirtyAtOpen.get(container);
    return valueAtOpen === undefined || valueAtOpen !== JSON.stringify(container.value);
  }

  private isMatDialogShell(): boolean {
    if (this.hostMatDialogRef === null) return false;
    const contentRoot = this.hostElement.closest('.mat-mdc-dialog-surface > *');
    return contentRoot !== null && (contentRoot === this.hostElement || contentRoot === this.hostElement.parentElement);
  }

  private initialFocusTarget(panel: HTMLElement): HTMLElement | null {
    const body = this.focusCandidates(panel.querySelector('.dialog__body'));
    return body.find(el => el.matches(FORM_FIELDS))
      ?? body[0]
      ?? this.focusCandidates(panel.querySelector('.dialog__footer'))[0]
      ?? null;
  }

  private focusCandidates(root: Element | null): HTMLElement[] {
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUS_CANDIDATES)).filter(el =>
      el.closest('app-dialog') === this.hostElement
      && !el.closest('app-draft-recovery-banner')
      && !el.classList.contains('mat-mdc-autocomplete-trigger')
      && !el.hasAttribute('readonly')
      && this.interactivity.isTabbable(el));
  }

  private hasOpenFieldOverlay(): boolean {
    return this.document.querySelector(FIELD_OVERLAY_PANELS) !== null;
  }

  private buildAdapter(config: DraftConfig, formGroup: FormGroup) {
    return {
      entityType: config.entityType,
      entityId: config.entityId,
      displayLabel: config.displayLabel ?? this.title(),
      route: config.route,
      form: formGroup,
      isDirty: () => formGroup.dirty,
      getFormSnapshot: () => config.snapshotFn ? config.snapshotFn() : formGroup.getRawValue(),
      restoreDraft: (data: Record<string, unknown>) => {
        if (config.restoreFn) {
          config.restoreFn(data);
        } else {
          formGroup.patchValue(data);
        }
        formGroup.markAsDirty();
      },
    };
  }
}
