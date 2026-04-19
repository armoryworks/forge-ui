import { ChangeDetectionStrategy, Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanLogEntry } from '../../../../shared/models/scan-log.model';
import { PinPromptDialogComponent, PinPromptDialogData } from '../pin-prompt-dialog/pin-prompt-dialog.component';

const DEFAULT_LOOKBACK_HOURS = 6;

@Component({
  selector: 'app-scan-undo-list',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './scan-undo-list.component.html',
  styleUrl: './scan-undo-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanUndoListComponent implements OnInit {
  private readonly scanActionService = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly closed = output<void>();

  readonly entries = signal<ScanLogEntry[]>([]);
  readonly loading = signal(false);
  readonly reversing = signal<number | null>(null);

  readonly recentEntries = computed(() => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - DEFAULT_LOOKBACK_HOURS);
    return this.entries().filter(e => new Date(e.createdAt) >= cutoff);
  });

  readonly todayCount = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.entries().filter(e => e.createdAt.startsWith(today)).length;
  });

  ngOnInit(): void {
    this.loadEntries();
  }

  loadEntries(): void {
    this.loading.set(true);
    const today = new Date().toISOString().slice(0, 10);
    this.scanActionService.getScanLog(undefined, today).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  reverseEntry(entry: ScanLogEntry): void {
    this.dialog.open(PinPromptDialogComponent, {
      width: '400px',
      data: { title: 'Enter PIN to reverse' } satisfies PinPromptDialogData,
    }).afterClosed().subscribe((pin: string | null) => {
      if (!pin) return;
      this.reversing.set(entry.id);
      this.scanActionService.reverseScanAction(entry.id, pin).subscribe({
        next: () => {
          this.reversing.set(null);
          const desc = this.buildReversalDescription(entry);
          this.snackbar.success(`Reversed: ${desc}`);
          this.loadEntries();
        },
        error: () => {
          this.reversing.set(null);
          this.snackbar.error('Failed to reverse action. Check your PIN.');
        },
      });
    });
  }

  close(): void {
    this.closed.emit();
  }

  private buildReversalDescription(entry: ScanLogEntry): string {
    const parts: string[] = [];
    if (entry.quantity) parts.push(`${entry.quantity}\u00D7`);
    if (entry.partNumber) parts.push(entry.partNumber);
    if (entry.actionType === 'Move' && entry.fromLocation) {
      parts.push(`moved back to ${entry.fromLocation}`);
    }
    return parts.join(' ') || entry.actionType;
  }
}
