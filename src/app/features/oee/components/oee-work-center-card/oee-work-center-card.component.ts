import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { OeeCalculation } from '../../models/oee-calculation.model';

@Component({
  selector: 'app-oee-work-center-card',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './oee-work-center-card.component.html',
  styleUrl: './oee-work-center-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OeeWorkCenterCardComponent {
  readonly data = input.required<OeeCalculation>();
  readonly selected = output<number>();

  protected getOeeClass(oeePercent: number): string {
    if (oeePercent >= 85) return 'oee-gauge--world-class';
    if (oeePercent >= 60) return 'oee-gauge--good';
    if (oeePercent >= 40) return 'oee-gauge--fair';
    return 'oee-gauge--poor';
  }
}
