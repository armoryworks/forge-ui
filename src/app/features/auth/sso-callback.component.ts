import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../shared/services/auth.service';
import { SnackbarService } from '../../shared/services/snackbar.service';

@Component({
  selector: 'app-sso-callback',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './sso-callback.component.html',
  styleUrl: './sso-callback.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SsoCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const token = params['sso_token'];
    const error = params['error'];

    if (token) {
      this.authService.handleSsoToken(token);
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    } else if (error === 'sso_failed') {
      this.snackbar.error(this.translate.instant('auth.ssoFailed'));
      this.router.navigate(['/login'], { replaceUrl: true });
    } else if (error === 'no_account') {
      this.snackbar.error(this.translate.instant('auth.noAccountFound'));
      this.router.navigate(['/login'], { replaceUrl: true });
    } else {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}
