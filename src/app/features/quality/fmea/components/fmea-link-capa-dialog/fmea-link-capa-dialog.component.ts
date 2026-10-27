import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { FmeaService } from '../../services/fmea.service';
import { FmeaItem } from '../../models/fmea-item.model';
import { NcrCapaService } from '../../../services/ncr-capa.service';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

export interface FmeaLinkCapaDialogData {
  fmeaId: number;
  item: FmeaItem;
}

@Component({
  selector: 'app-fmea-link-capa-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, SelectComponent],
  templateUrl: './fmea-link-capa-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmeaLinkCapaDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<FmeaLinkCapaDialogComponent, boolean>);
  private readonly fmeaService = inject(FmeaService);
  private readonly capaService = inject(NcrCapaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<FmeaLinkCapaDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly capaControl = new FormControl<number | null>(this.data.item.capaId, [Validators.required]);

  protected readonly capaOptions = toSignal(
    this.capaService.getCapas().pipe(map(capas => capas.map(c => ({ value: c.id, label: `${c.capaNumber} — ${c.title}` }) as SelectOption))),
    { initialValue: [] as SelectOption[] },
  );

  protected close(): void { this.dialogRef.close(false); }

  protected save(): void {
    const capaId = this.capaControl.value;
    if (capaId == null || this.saving()) return;
    this.saving.set(true);
    this.fmeaService.linkCapa(this.data.fmeaId, this.data.item.id, capaId).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('fmea.capaLinked'));
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'fmea.saveFailed');
      },
    });
  }
}
