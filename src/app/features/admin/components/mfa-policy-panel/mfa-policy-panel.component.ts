import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { MfaService } from '../../../account/services/mfa.service';
import { MfaComplianceUser } from '../../../account/models/mfa.model';

const DEFAULT_GRACE_DAYS = 7;
const MAX_GRACE_DAYS = 90;

@Component({
  selector: 'app-mfa-policy-panel',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, ColumnCellDirective, SelectComponent, InputComponent, LoadingBlockDirective, TranslatePipe],
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

  protected readonly maxGraceDays = MAX_GRACE_DAYS;

  protected readonly enforcedRolesControl = new FormControl<string[]>([], { nonNullable: true });
  protected readonly graceDaysControl = new FormControl<number>(DEFAULT_GRACE_DAYS, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(0), Validators.max(MAX_GRACE_DAYS)],
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'fullName', header: 'common.name', sortable: true },
    { field: 'email', header: 'common.email', sortable: true },
    { field: 'role', header: 'columns.role', sortable: true, filterable: true, type: 'text' },
    { field: 'mfaEnabled', header: 'columns.mfaEnabled', sortable: true, width: '100px' },
    { field: 'mfaDeviceType', header: 'columns.deviceType', sortable: true, width: '120px' },
    { field: 'isEnforcedByPolicy', header: 'adminPanels.mfa.enforced', sortable: true, width: '100px' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);

    this.refDataService.getRolesAsOptions().subscribe({
      next: (roles) => this.roles.set(roles),
    });

    this.mfaService.getPolicy().subscribe({
      next: (policy) => {
        this.enforcedRolesControl.setValue([...policy.requiredRoles], { emitEvent: false });
        this.graceDaysControl.setValue(policy.enrollmentGraceDays, { emitEvent: false });
      },
    });

    this.mfaService.getCompliance().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  protected savePolicy(): void {
    if (this.graceDaysControl.invalid) {
      this.graceDaysControl.markAsTouched();
      return;
    }
    this.saving.set(true);

    this.mfaService.setPolicy(this.enforcedRolesControl.value, Number(this.graceDaysControl.value)).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('adminPanels.mfa.snackbar.policySaved'));
        this.loadData();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'adminPanels.mfa.snackbar.policyReset');
      },
    });
  }
}
