import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { EcoService } from '../../services/eco.service';
import { EcoImpact } from '../../models/eco-impact.model';
import { EcoPartImpact } from '../../models/eco-part-impact.model';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

@Component({
  selector: 'app-eco-impact',
  standalone: true,
  imports: [DateOnlyPipe, DecimalPipe, TranslatePipe, EntityLinkComponent, LoadingBlockDirective],
  templateUrl: './eco-impact.component.html',
  styleUrl: './eco-impact.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcoImpactComponent {
  private readonly ecoService = inject(EcoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ecoId = input.required<number>();

  protected readonly impact = signal<EcoImpact | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    effect(() => this.load(this.ecoId()));
  }

  protected load(ecoId: number): void {
    this.loading.set(true);
    this.failed.set(false);
    this.ecoService.getImpact(ecoId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: impact => {
        this.impact.set(impact);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  protected isEmpty(part: EcoPartImpact): boolean {
    return part.openJobs.length === 0 && part.openPurchaseOrderLines.length === 0
      && part.openSalesOrderLines.length === 0 && part.stockByRevision.length === 0;
  }

  protected isOtherRevision(part: EcoPartImpact, revision: string | null): boolean {
    return revision !== null && revision !== part.currentRevision;
  }
}
