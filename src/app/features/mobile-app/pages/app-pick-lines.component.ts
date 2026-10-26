import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../shared/services/auth.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { PICK_ROLES } from '../../../shared/utils/mobile-app-screens';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';
import { PickWaveService } from '../../shipping/pick-waves/services/pick-wave.service';
import { PickLine } from '../../shipping/pick-waves/models/pick-line.model';
import { ConfirmPickLineDialogComponent } from '../../shipping/pick-waves/components/confirm-pick-line-dialog/confirm-pick-line-dialog.component';

/**
 * The Pick tab: the open lines of released waves assigned to the person or to no one, in walk order (bin,
 * part, lot, quantity). Tapping a line confirms what was picked, or records a short pick with a reason. On a
 * shared device the person identifies before the list loads, and each line they open or confirm keeps them identified.
 */
@Component({
  selector: 'app-app-pick-lines',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, IdentityPromptComponent, ConfirmPickLineDialogComponent],
  templateUrl: './app-pick-lines.component.html',
  styleUrl: './app-pick-lines.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppPickLinesComponent {
  private readonly pickWaves = inject(PickWaveService);
  private readonly instances = inject(InstanceService);
  private readonly identity = inject(SharedIdentityService);
  private readonly auth = inject(AuthService);

  protected readonly lines = signal<PickLine[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly identifying = signal(false);
  protected readonly confirming = signal<PickLine | null>(null);

  protected readonly needsIdentity = computed(() =>
    !!this.instances.instance()?.shared && !this.identity.identified());

  protected readonly notAllowed = computed(() =>
    !this.needsIdentity() && !this.auth.hasAnyRole([...PICK_ROLES]));

  constructor() {
    effect(() => {
      const blocked = this.needsIdentity() || this.notAllowed();
      untracked(() => {
        if (blocked) this.lines.set([]);
        else this.load();
      });
    });
  }

  protected openLine(line: PickLine): void {
    this.keepIdentity();
    this.confirming.set(line);
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.pickWaves.getMyLines().subscribe({
      next: (lines) => { this.lines.set(lines); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }

  protected onConfirmed(): void {
    this.confirming.set(null);
    this.keepIdentity();
    this.load();
  }

  private keepIdentity(): void {
    if (this.instances.instance()?.shared) this.identity.touch();
  }

  protected onIdentified(): void {
    this.identifying.set(false);
  }
}
