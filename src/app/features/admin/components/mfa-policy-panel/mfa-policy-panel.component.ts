import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { MfaService } from '../../../account/services/mfa.service';
import { MfaComplianceUser } from '../../../account/models/mfa.model';

@Component({
  selector: 'app-mfa-policy-panel',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, ColumnCellDirective, SelectComponent, LoadingBlockDirective, TranslatePipe],
  templateUrl: './mfa-policy-panel.component.html',
  styleUrl: './mfa-policy-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaPolicyPanelComponent implements OnInit {
  private readonly mfaService = inject(MfaService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly users = signal<MfaComplianceUser[]>([]);
  protected readonly roles = signal<SelectOption[]>([]);

  protected readonly enforcedRolesControl = new FormControl<string[]>([], { nonNullable: true });

  protected readonly columns: ColumnDef[] = [
    { field: 'fullName', header: 'Name', sortable: true },
    { field: 'email', header: 'Email', sortable: true },
    { field: 'role', header: 'Role', sortable: true, filterable: true, type: 'text' },
    { field: 'mfaEnabled', header: 'MFA Enabled', sortable: true, width: '100px' },
    { field: 'mfaDeviceType', header: 'Device Type', sortable: true, width: '120px' },
    { field: 'isEnforcedByPolicy', header: 'Enforced', sortable: true, width: '100px' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);

    this.refDataService.getRolesAsOptions().subscribe({
      next: (roles) => this.roles.set(roles),
    });

    this.mfaService.getCompliance().subscribe({
      next: (users) => {
        this.users.set(users);
        // Derive currently enforced roles from user data
        const enforced = new Set(
          users.filter(u => u.isEnforcedByPolicy).map(u => u.role),
        );
        this.enforcedRolesControl.setValue([...enforced], { emitEvent: false });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  protected savePolicy(): void {
    this.saving.set(true);

    this.mfaService.setPolicy(this.enforcedRolesControl.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('adminPanels.mfa.snackbar.policySaved'));
        this.loadData();
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('adminPanels.mfa.snackbar.policyReset'));
      },
    });
  }
}
