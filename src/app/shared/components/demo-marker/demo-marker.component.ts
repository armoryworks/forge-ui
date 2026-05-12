import { ChangeDetectionStrategy, Component } from '@angular/core';

import { environment } from '../../../../environments/environment';

/**
 * Non-intrusive demo-mode marker set. Rendered only when `environment.demoMode`
 * is true. Every element is `pointer-events: none` so nothing this component
 * paints can block a click, obscure a target, or change layout height.
 *
 * Two markers:
 *   1. Obvious amber "DEMO" chip pinned to the top-right corner.
 *   2. Subtle full-viewport diagonal text watermark (~2% opacity). Survives
 *      cropping / resizing of screenshots — a tell only the site owner knows
 *      to look for when a "bug" screenshot shows up that was actually taken
 *      against the demo site.
 */
@Component({
  selector: 'app-demo-marker',
  standalone: true,
  template: `
    @if (show) {
      <div class="demo-chip" aria-hidden="true">DEMO</div>
      <div class="demo-watermark" aria-hidden="true" data-demo-watermark="forge-demo"></div>
    }
  `,
  styleUrl: './demo-marker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoMarkerComponent {
  protected readonly show = environment.demoMode === true;
}
