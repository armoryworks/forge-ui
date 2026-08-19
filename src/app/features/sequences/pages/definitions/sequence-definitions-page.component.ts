import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SequencesService } from '../../services/sequences.service';
import { SequenceDefinition, SequenceDefinitionStatus, SequenceGateDefinition } from '../../models/sequence.model';

/** Sequence definitions: browse the versioned graphs and run their lifecycle (publish / new version / retire). */
@Component({
  selector: 'app-sequence-definitions-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslatePipe, SelectComponent],
  templateUrl: './sequence-definitions-page.component.html',
  styleUrl: './sequence-definitions-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SequenceDefinitionsPageComponent {
  private readonly service = inject(SequencesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly definitions = signal<SequenceDefinition[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly selected = signal<SequenceDefinition | null>(null);

  protected readonly statusFilter = new FormControl<SequenceDefinitionStatus | ''>('', { nonNullable: true });
  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('sequences.filter.all') },
    { value: 'Draft', label: 'Draft' },
    { value: 'Published', label: 'Published' },
    { value: 'Retired', label: 'Retired' },
  ];

  protected readonly isDraft = computed(() => this.selected()?.status === 'Draft');
  protected readonly isPublished = computed(() => this.selected()?.status === 'Published');

  private readonly route = inject(ActivatedRoute);

  constructor() {
    this.reload();
    this.statusFilter.valueChanges.subscribe(() => this.reload());
    // Re-select a definition after the editor navigates back with ?selected=<id>.
    const selectedId = Number(this.route.snapshot.queryParamMap.get('selected'));
    if (selectedId > 0) {
      this.service.getDefinition(selectedId).subscribe({ next: (full) => this.selected.set(full) });
    }
  }

  protected reload(): void {
    this.loading.set(true);
    this.service.getDefinitions(undefined, this.statusFilter.value || undefined).subscribe({
      next: (list) => {
        this.definitions.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected select(def: SequenceDefinition): void {
    this.service.getDefinition(def.id).subscribe({ next: (full) => this.selected.set(full) });
  }

  protected gatesFor(stepKey: string): SequenceGateDefinition[] {
    return (this.selected()?.gates ?? []).filter(g => g.stepKey === stepKey);
  }

  private run(op: () => ReturnType<SequencesService['publishDefinition']>, successKey: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    op().subscribe({
      next: (def) => {
        this.snackbar.success(this.translate.instant(successKey));
        this.selected.set(def);
        this.busy.set(false);
        this.reload();
      },
      error: (err) => {
        this.snackbar.error(err?.error?.detail ?? this.translate.instant('sequences.definitions.actionFailed'));
        this.busy.set(false);
      },
    });
  }

  protected publish(): void {
    const def = this.selected();
    if (!def) return;
    this.run(() => this.service.publishDefinition(def.id), 'sequences.definitions.published');
  }

  protected newVersion(): void {
    const def = this.selected();
    if (!def) return;
    this.run(() => this.service.newDefinitionVersion(def.id), 'sequences.definitions.newVersionCreated');
  }

  protected retire(): void {
    const def = this.selected();
    if (!def) return;
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('sequences.definitions.retireTitle'),
        message: this.translate.instant('sequences.definitions.retireMessage', { name: def.name }),
        confirmLabel: this.translate.instant('sequences.definitions.retire'),
        severity: 'danger',
      },
      width: '440px',
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.busy.set(true);
      this.service.retireDefinition(def.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('sequences.definitions.retired'));
          this.selected.set(null);
          this.busy.set(false);
          this.reload();
        },
        error: (err) => {
          this.snackbar.error(err?.error?.detail ?? this.translate.instant('sequences.definitions.actionFailed'));
          this.busy.set(false);
        },
      });
    });
  }

  protected statusChipClass(status: string): string {
    return { Draft: 'chip--muted', Published: 'chip--success', Retired: 'chip--danger' }[status] ?? 'chip--muted';
  }
}
