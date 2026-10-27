import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PpapService } from '../../services/ppap.service';
import { PpapSubmission } from '../../models/ppap-submission.model';
import { PpapElement } from '../../models/ppap-element.model';
import { PPAP_ELEMENT_STATUSES, PpapElementStatus } from '../../models/ppap-element-status.model';
import { PPAP_STATUS_CHIP, PpapStatus } from '../../models/ppap-status.model';
import { PPAP_AUTHOR_ROLES, PPAP_RESPONSE_ROLES } from '../../models/ppap-roles.model';
import { PpapResponseDialogComponent, PpapResponseDialogData } from '../../components/ppap-response-dialog/ppap-response-dialog.component';
import { PpapElementFilesComponent } from '../../components/ppap-element-files/ppap-element-files.component';
import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { AuthService } from '../../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { DateOnlyPipe } from '../../../../../shared/pipes/date-only.pipe';

const LOCKED_STATUSES: readonly PpapStatus[] = ['Submitted', 'Approved'];

@Component({
  selector: 'app-ppap-detail',
  standalone: true,
  imports: [DateOnlyPipe, DatePipe, ReactiveFormsModule, RouterLink, TranslatePipe, PageHeaderComponent, SelectComponent, TextareaComponent, LoadingBlockDirective, PpapElementFilesComponent],
  templateUrl: './ppap-detail.component.html',
  styleUrl: './ppap-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PpapDetailComponent {
  private readonly ppapService = inject(PpapService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);

  protected readonly canAuthor = this.auth.hasAnyRole(PPAP_AUTHOR_ROLES);
  protected readonly canRecordResponse = this.auth.hasAnyRole(PPAP_RESPONSE_ROLES);
  protected readonly submission = signal<PpapSubmission | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly expanded = signal<number | null>(null);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly statusControls = new Map<number, FormControl<PpapElementStatus>>();
  protected readonly notesControls = new Map<number, FormControl<string>>();

  protected readonly elementStatusOptions: SelectOption[] = PPAP_ELEMENT_STATUSES.map(s => ({
    value: s, label: this.translate.instant(`ppap.element${s}`),
  }));

  protected readonly editable = computed(() => {
    const s = this.submission();
    return !!s && this.canAuthor && !LOCKED_STATUSES.includes(s.status);
  });

  protected readonly incompleteRequired = computed(() =>
    (this.submission()?.elements ?? []).filter(e => e.isRequired && e.status !== 'Complete' && e.status !== 'NotApplicable'));

  protected readonly canSubmit = computed(() => this.editable() && this.incompleteRequired().length === 0);
  protected readonly canRespond = computed(() => this.canRecordResponse && this.submission()?.status === 'Submitted');
  protected readonly canSign = computed(() => this.canAuthor && !!this.submission() && !this.submission()!.pswSignedAt);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.ppapService.get(this.id).subscribe({
      next: s => {
        this.statusControls.clear();
        this.notesControls.clear();
        for (const e of s.elements) {
          this.statusControls.set(e.elementNumber, new FormControl<PpapElementStatus>(e.status, { nonNullable: true }));
          this.notesControls.set(e.elementNumber, new FormControl<string>(e.notes ?? '', { nonNullable: true }));
        }
        this.submission.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusChip(status: PpapStatus): string {
    return `chip ${PPAP_STATUS_CHIP[status] ?? 'chip--muted'}`;
  }

  protected elementChip(status: PpapElementStatus): string {
    return status === 'Complete' ? 'chip chip--success'
      : status === 'NotApplicable' ? 'chip chip--muted'
      : status === 'InProgress' ? 'chip chip--primary' : 'chip chip--warning';
  }

  protected toggle(element: PpapElement): void {
    this.expanded.update(current => current === element.elementNumber ? null : element.elementNumber);
  }

  protected changeElementStatus(element: PpapElement): void {
    const status = this.statusControls.get(element.elementNumber)?.value;
    if (!status || status === element.status) return;
    this.saveElement(element, { status });
  }

  protected saveNotes(element: PpapElement): void {
    const notes = this.notesControls.get(element.elementNumber)?.value.trim() ?? '';
    this.saveElement(element, { notes: notes || null });
  }

  private saveElement(element: PpapElement, request: { status?: PpapElementStatus; notes?: string | null }): void {
    this.ppapService.updateElement(this.id, element.elementNumber, request).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('ppap.elementSaved'));
        this.load();
      },
      error: (err: unknown) => {
        this.statusControls.get(element.elementNumber)?.setValue(element.status, { emitEvent: false });
        this.snackbar.errorFrom(err, 'ppap.saveFailed');
      },
    });
  }

  protected onEvidenceChanged(element: PpapElement, count: number): void {
    this.submission.update(s => s ? {
      ...s, elements: s.elements.map(e => e.id === element.id ? { ...e, attachmentCount: count } : e),
    } : s);
  }

  protected submit(): void {
    if (!this.canSubmit() || this.busy()) return;
    this.busy.set(true);
    this.ppapService.submit(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.snackbar.success(this.translate.instant('ppap.submitted'));
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'ppap.submitFailed');
      },
    });
  }

  protected recordResponse(): void {
    const s = this.submission();
    if (!s) return;
    this.dialog.open<PpapResponseDialogComponent, PpapResponseDialogData, boolean>(PpapResponseDialogComponent, {
      width: '480px', data: { submissionId: s.id, submissionNumber: s.submissionNumber },
    }).afterClosed().subscribe(saved => {
      if (saved) this.load();
    });
  }

  protected signPsw(): void {
    const s = this.submission();
    if (!s) return;
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('ppap.signPswTitle'),
        message: this.translate.instant('ppap.signPswMessage', { number: s.submissionNumber, part: s.partNumber }),
        confirmLabel: this.translate.instant('ppap.signPsw'),
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.ppapService.signPsw(this.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('ppap.pswSigned'));
          this.load();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'ppap.saveFailed'),
      });
    });
  }
}
