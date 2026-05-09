import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { LeadsService } from '../../../leads/services/leads.service';
import { LeadItem } from '../../../leads/models/lead-item.model';

/**
 * Phase 1o.2 — picker for the "Convert from lead" entry path. Surfaces
 * non-Lost / non-Converted leads (the only ones eligible for conversion);
 * search filters by company / contact / email. Returns the selected
 * lead so the caller can hand it to the existing lead-convert dialog.
 */
@Component({
  selector: 'app-lead-picker-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, LoadingBlockDirective,
  ],
  templateUrl: './lead-picker-dialog.component.html',
  styleUrl: './lead-picker-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadPickerDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<LeadPickerDialogComponent, LeadItem | undefined>);
  private readonly leadsService = inject(LeadsService);
  protected readonly translate = inject(TranslateService);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly leads = signal<LeadItem[]>([]);
  protected readonly loading = signal(false);

  protected readonly filtered = computed<LeadItem[]>(() => {
    const term = this.searchControl.value?.toLowerCase().trim() ?? '';
    return this.leads()
      // Eligible leads only: Lost + Converted are terminal.
      .filter(l => l.status !== 'Lost' && l.status !== 'Converted')
      .filter(l => !term
        || l.companyName.toLowerCase().includes(term)
        || (l.contactName ?? '').toLowerCase().includes(term)
        || (l.email ?? '').toLowerCase().includes(term))
      .slice(0, 50);
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.leadsService.getLeads().subscribe({
      next: (data) => {
        this.leads.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected pick(lead: LeadItem): void {
    this.dialogRef.close(lead);
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
