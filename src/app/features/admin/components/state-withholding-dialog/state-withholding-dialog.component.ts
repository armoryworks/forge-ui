import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AdminService } from '../../services/admin.service';
import { ReferenceDataEntry } from '../../models/reference-data-entry.model';

interface StateEntry {
  code: string;
  label: string;
  category: 'no_tax' | 'federal' | 'state_form';
  formName: string | null;
  docuSealTemplateId: number | null;
}

@Component({
  selector: 'app-state-withholding-dialog',
  standalone: true,
  imports: [DialogComponent, LoadingBlockDirective],
  templateUrl: './state-withholding-dialog.component.html',
  styleUrl: './state-withholding-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateWithholdingDialogComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly dialogRef = inject(MatDialogRef<StateWithholdingDialogComponent>);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly states = signal<StateEntry[]>([]);
  protected readonly currentState = signal<string | null>(null);

  private readonly byCode = (a: StateEntry, b: StateEntry) => a.code.localeCompare(b.code);
  protected readonly noTaxStates = computed(() => this.states().filter(s => s.category === 'no_tax').sort(this.byCode));
  protected readonly federalStates = computed(() => this.states().filter(s => s.category === 'federal').sort(this.byCode));
  protected readonly stateFormStates = computed(() => this.states().filter(s => s.category === 'state_form'));
  protected readonly readyStates = computed(() => this.stateFormStates().filter(s => s.docuSealTemplateId !== null).sort(this.byCode));
  protected readonly needsUploadStates = computed(() => this.stateFormStates().filter(s => s.docuSealTemplateId === null).sort(this.byCode));

  ngOnInit(): void {
    this.loading.set(true);
    this.adminService.getStateWithholdingData().subscribe({
      next: (data) => {
        this.states.set(data.map(d => this.parseEntry(d)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.adminService.getSystemSettings().subscribe({
      next: (settings) => {
        const cs = settings.find(s => s.key === 'company_state');
        if (cs) this.currentState.set(cs.value);
      },
    });
  }

  protected selectState(stateCode: string): void {
    this.saving.set(true);
    this.adminService.setCompanyState(stateCode).subscribe({
      next: () => {
        this.currentState.set(stateCode);
        this.saving.set(false);
        const state = this.states().find(s => s.code === stateCode);
        this.snackbar.success(`Company state set to ${state?.label ?? stateCode}`);
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }

  protected getStatusIcon(state: StateEntry): string {
    if (state.code === this.currentState()) return 'check_circle';
    if (state.category === 'no_tax') return 'block';
    if (state.category === 'federal') return 'description';
    if (state.docuSealTemplateId) return 'verified';
    return 'upload_file';
  }

  protected getStatusClass(state: StateEntry): string {
    if (state.code === this.currentState()) return 'chip chip--primary';
    if (state.category === 'no_tax') return 'chip chip--muted';
    if (state.category === 'federal') return 'chip chip--info';
    if (state.docuSealTemplateId) return 'chip chip--success';
    return 'chip chip--warning';
  }

  protected getStatusLabel(state: StateEntry): string {
    if (state.code === this.currentState()) return 'Active';
    if (state.category === 'no_tax') return 'No Tax';
    if (state.category === 'federal') return 'Uses W-4';
    if (state.docuSealTemplateId) return 'Ready';
    return 'Needs Upload';
  }

  private parseEntry(entry: ReferenceDataEntry): StateEntry {
    let category: StateEntry['category'] = 'state_form';
    let formName: string | null = null;
    let docuSealTemplateId: number | null = null;

    if (entry.metadata) {
      try {
        const meta = JSON.parse(entry.metadata);
        category = meta.category ?? 'state_form';
        formName = meta.formName ?? null;
        docuSealTemplateId = meta.docuSealTemplateId ?? null;
      } catch { /* ignore parse errors */ }
    }

    return {
      code: entry.code,
      label: entry.label,
      category,
      formName,
      docuSealTemplateId,
    };
  }
}
