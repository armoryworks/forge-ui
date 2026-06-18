import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../../environments/environment';

interface LowStockRow {
  partId: number;
  partNumber: string;
  description: string;
  currentStock: number;
  minStockThreshold: number;
  reorderPoint: number | null;
}

interface PartSummary {
  partId: number;
  onHand: number;
}

/**
 * Inventory snapshot widget — parts on hand, total units, and the parts that
 * have fallen below their min threshold. The lead dashboard widget when only the
 * Inventory module is enabled (gated by CAP-INV-CORE in the widget registry).
 */
@Component({
  selector: 'app-low-stock-widget',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './low-stock-widget.component.html',
  styleUrl: './low-stock-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockWidgetComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly lowStock = signal<LowStockRow[]>([]);
  protected readonly partCount = signal(0);
  protected readonly totalOnHand = signal(0);

  protected readonly lowStockCount = computed(() => this.lowStock().length);

  ngOnInit(): void {
    this.http.get<LowStockRow[]>(`${environment.apiUrl}/inventory/low-stock`)
      .subscribe(rows => this.lowStock.set(rows ?? []));
    this.http.get<PartSummary[]>(`${environment.apiUrl}/inventory/parts`)
      .subscribe(parts => {
        this.partCount.set(parts?.length ?? 0);
        this.totalOnHand.set((parts ?? []).reduce((sum, p) => sum + (p.onHand ?? 0), 0));
      });
  }
}
