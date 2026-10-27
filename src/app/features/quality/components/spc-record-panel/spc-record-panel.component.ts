import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { SpcCharacteristic } from '../../models/spc.model';
import { SpcDataEntryComponent } from '../spc-data-entry.component';

@Component({
  selector: 'app-spc-record-panel',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, SpcDataEntryComponent],
  templateUrl: './spc-record-panel.component.html',
  styleUrl: './spc-record-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpcRecordPanelComponent {
  readonly characteristics = input.required<SpcCharacteristic[]>();
  readonly jobId = input.required<number>();
  readonly closed = output<void>();

  private readonly chosenId = signal<number | null>(null);

  protected readonly chosen = computed<SpcCharacteristic[]>(() => {
    const list = this.characteristics();
    const picked = list.find(c => c.id === this.chosenId()) ?? (list.length === 1 ? list[0] : null);
    return picked ? [picked] : [];
  });

  protected choose(characteristic: SpcCharacteristic): void {
    this.chosenId.set(characteristic.id);
  }
}
