import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-auto-po-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ToggleComponent, LoadingBlockDirective,
  ],
  templateUrl: './auto-po-settings.component.html',
  styleUrl: './auto-po-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoPoSettingsComponent {
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    enabled: new FormControl(false),
    mode: new FormControl('Suggest'),
    bufferDays: new FormControl('3'),
    notifyChat: new FormControl(true),
    // S4a — auto-generate the internal customer-PO document on quote→order convert.
    autoCustomerPo: new FormControl(false),
  });

  protected readonly modeOptions: SelectOption[] = [
    { value: 'Suggest', label: this.translate.instant('autoPo.modeSuggest') },
    { value: 'Draft', label: this.translate.instant('autoPo.modeDraft') },
    { value: 'Automatic', label: this.translate.instant('autoPo.modeAutomatic') },
  ];

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    this.loading.set(true);
    this.adminService.getSystemSettings().subscribe({
      next: (settings) => {
        const get = (key: string) => settings.find(s => s.key === key)?.value;
        this.form.patchValue({
          enabled: get('inventory:auto_po_enabled') === 'true',
          mode: get('inventory:auto_po_mode') ?? 'Suggest',
          bufferDays: get('inventory:auto_po_buffer_days') ?? '3',
          notifyChat: get('inventory:auto_po_notify_chat') !== 'false',
          autoCustomerPo: get('sales:auto_customer_po_enabled') === 'true',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected saveSettings(): void {
    this.saving.set(true);
    const val = this.form.getRawValue();
    const settings = [
      { key: 'inventory:auto_po_enabled', value: String(val.enabled ?? false) },
      { key: 'inventory:auto_po_mode', value: val.mode ?? 'Suggest' },
      { key: 'inventory:auto_po_buffer_days', value: val.bufferDays ?? '3' },
      { key: 'inventory:auto_po_notify_chat', value: String(val.notifyChat ?? true) },
      { key: 'sales:auto_customer_po_enabled', value: String(val.autoCustomerPo ?? false) },
    ];
    this.adminService.updateSystemSettings(settings).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('autoPo.settingsSaved'));
      },
      error: () => this.saving.set(false),
    });
  }
}
