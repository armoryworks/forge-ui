import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

/**
 * Scan home screen. This build renders the viewfinder placeholder only;
 * ML Kit camera scanning and the contextual action sheet land with the
 * scan feature step.
 */
@Component({
  selector: 'app-app-scan',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './app-scan.component.html',
  styleUrl: './app-scan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppScanComponent {}
