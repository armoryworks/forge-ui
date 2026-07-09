import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SalesOrderAcceptanceService } from '../../services/sales-order-acceptance.service';
import { PublicSoAcceptance } from '../../models/public-so-acceptance.model';

/**
 * Anonymous customer-facing acceptance page (`/accept/:token`), served OUTSIDE
 * the auth-guarded shell. The visitor has no employee session; the auth
 * interceptor attaches no token (none exists) and does not force login on a
 * 4xx from the public endpoints. Self-contained: renders the order summary
 * from the public GET, optionally asks for a verification key, captures the
 * signer's name, and POSTs the acceptance.
 */
@Component({
  selector: 'app-public-acceptance',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './public-acceptance.component.html',
  styleUrl: './public-acceptance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicAcceptanceComponent {
  protected readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(SalesOrderAcceptanceService);

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly data = signal<PublicSoAcceptance | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    verificationKey: new FormControl('', { nonNullable: true }),
    acceptedByName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  private readonly nameValue = toSignal(this.form.controls.acceptedByName.valueChanges, { initialValue: '' });
  private readonly keyValue = toSignal(this.form.controls.verificationKey.valueChanges, { initialValue: '' });

  protected readonly canRespond = computed(() => {
    const d = this.data();
    return !!d && !d.alreadyResponded && d.status === 'Pending';
  });

  /** A previously-responded or non-pending order shows a friendly closing message instead of the form. */
  protected readonly closedMessage = computed(() => {
    const d = this.data();
    if (!d) return null;
    if (d.alreadyResponded) {
      return this.translate.instant('publicAcceptance.alreadyMessage', { status: d.status });
    }
    if (d.status !== 'Pending') {
      return this.translate.instant('publicAcceptance.notPendingMessage', { status: d.status });
    }
    return null;
  });

  protected readonly submitDisabled = computed(() => {
    const d = this.data();
    if (!d) return true;
    if (!this.nameValue().trim()) return true;
    if (d.requiresKey && !this.keyValue().trim()) return true;
    return false;
  });

  constructor() {
    this.load();
  }

  private load(): void {
    if (!this.token) {
      this.loading.set(false);
      this.loadError.set(true);
      return;
    }
    this.service.getPublic(this.token).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => { this.loading.set(false); this.loadError.set(true); },
    });
  }

  protected submit(): void {
    const d = this.data();
    if (!d || this.submitDisabled()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    this.service.acceptPublic(this.token, {
      verificationKey: this.form.controls.verificationKey.value,
      acceptedByName: this.form.controls.acceptedByName.value,
    }).subscribe({
      next: () => { this.submitting.set(false); this.submitted.set(true); },
      error: () => {
        this.submitting.set(false);
        this.submitError.set(this.translate.instant('publicAcceptance.submitError'));
      },
    });
  }
}
