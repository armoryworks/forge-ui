import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TelemetryAgreement } from '../../models/telemetry.model';

/**
 * The agreement an operator reads before letting Armory Works see this system's
 * health. Shown in full — including the verbatim payload — because consent to a
 * vendor reading your system is only meaningful if what's being agreed to is on
 * screen rather than linked to.
 *
 * Both buttons record a decision. Declining is a deliberate, recorded answer rather
 * than a dismissal, which is why closing the dialog does nothing: an unanswered
 * question should stay unanswered instead of being silently filed as a "no".
 */
@Component({
  selector: 'app-telemetry-consent-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, TranslatePipe],
  templateUrl: './telemetry-consent-dialog.component.html',
  styleUrl: './telemetry-consent-dialog.component.scss',
})
export class TelemetryConsentDialogComponent {
  /**
   * Null until the agreement has loaded; the template renders nothing until then.
   * Nullable rather than required so the dialog can never half-render against a
   * missing agreement — and so it stays constructible under test.
   */
  readonly agreement = input<TelemetryAgreement | null>(null);
  readonly saving = input<boolean>(false);

  /** True to accept, false to decline. Closing emits nothing. */
  readonly decided = output<boolean>();
  readonly closed = output<void>();

  protected readonly showPayload = signal(false);

  protected readonly payloadToggleKey = computed(() =>
    this.showPayload() ? 'admin.telemetry.hidePayload' : 'admin.telemetry.showPayload');

  protected togglePayload(): void {
    this.showPayload.update(v => !v);
  }
}
