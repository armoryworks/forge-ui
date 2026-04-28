import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { PresetService } from '../../../../shared/services/preset.service';
import { PresetSummary } from '../../../../shared/models/preset.model';

/**
 * Phase 4 Phase-G — Preset browser landing page.
 *
 * Card grid of the 8 presets (7 named + Custom). Each card shows the name,
 * short description, capability count, recommended-for tags, and a click
 * target that navigates to the preset detail page. A multi-select Compare
 * mode lets the admin pick 2-4 presets and open the side-by-side compare
 * matrix at /admin/presets/compare?ids=...
 */
@Component({
  selector: 'app-preset-browser',
  standalone: true,
  imports: [CommonModule, RouterModule, PageLayoutComponent, LoadingBlockDirective],
  templateUrl: './preset-browser.component.html',
  styleUrl: './preset-browser.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresetBrowserComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly presetService = inject(PresetService);

  protected readonly presets = this.presetService.presets;
  protected readonly loading = this.presetService.loading;

  protected readonly compareMode = signal<boolean>(false);
  protected readonly selectedForCompare = signal<Set<string>>(new Set());

  protected readonly selectedCount = computed(() => this.selectedForCompare().size);
  protected readonly canCompare = computed(() => {
    const n = this.selectedCount();
    return n >= 2 && n <= 4;
  });

  ngOnInit(): void {
    this.presetService.loadPresets().subscribe();
  }

  protected toggleCompareMode(): void {
    this.compareMode.update((v) => !v);
    if (!this.compareMode()) this.selectedForCompare.set(new Set());
  }

  protected isSelected(preset: PresetSummary): boolean {
    return this.selectedForCompare().has(preset.id);
  }

  protected toggleSelect(preset: PresetSummary, event?: Event): void {
    event?.stopPropagation();
    const next = new Set(this.selectedForCompare());
    if (next.has(preset.id)) {
      next.delete(preset.id);
    } else if (next.size < 4) {
      next.add(preset.id);
    }
    this.selectedForCompare.set(next);
  }

  protected openDetail(preset: PresetSummary): void {
    if (this.compareMode()) {
      this.toggleSelect(preset);
      return;
    }
    if (preset.isCustom) {
      this.router.navigate(['/admin/presets/custom']);
    } else {
      this.router.navigate(['/admin/presets', preset.id]);
    }
  }

  protected runCompare(): void {
    if (!this.canCompare()) return;
    const ids = Array.from(this.selectedForCompare());
    this.router.navigate(['/admin/presets/compare'], {
      queryParams: { ids: ids.join(',') },
    });
  }

  protected openCustom(): void {
    this.router.navigate(['/admin/presets/custom']);
  }

  protected backToCapabilities(): void {
    this.router.navigate(['/admin/capabilities']);
  }
}
