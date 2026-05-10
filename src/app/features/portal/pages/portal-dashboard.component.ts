import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { PortalSummary } from '../models/portal.model';
import { PortalService } from '../services/portal.service';

@Component({
  selector: 'app-portal-dashboard',
  standalone: true,
  imports: [RouterLink, TranslatePipe, LoadingBlockDirective],
  templateUrl: './portal-dashboard.component.html',
  styleUrl: './portal-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalDashboardComponent implements OnInit {
  private readonly portal = inject(PortalService);

  protected readonly summary = signal<PortalSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly identity = this.portal.identity;

  ngOnInit(): void {
    this.portal.getDashboard().subscribe({
      next: (data) => { this.summary.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
