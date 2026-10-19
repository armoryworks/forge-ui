import {
  ChangeDetectionStrategy, Component, computed, inject, OnDestroy, output, signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KioskTerminal, Team } from '../../models/kiosk-terminal.model';
import { randomId } from '../../../../shared/utils/random-id';
import { httpProblemDetail } from '../../../../shared/utils/http-problem-detail';
import { MfaChallengeComponent } from '../../../auth/mfa-challenge.component';
import { MfaValidateResponse } from '../../../account/models/mfa.model';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';

type SetupPhase = 'admin-login' | 'mfa' | 'configure';

const SETUP_ROLES = ['Admin', 'Manager'];
const TERMINAL_NAME_MAX = 100;

@Component({
  selector: 'app-kiosk-setup',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent, MfaChallengeComponent, LanguageToggleComponent],
  templateUrl: './kiosk-setup.component.html',
  styleUrl: './kiosk-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskSetupComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly shopFloorService = inject(ShopFloorService);
  private readonly translate = inject(TranslateService);

  readonly configured = output<KioskTerminal>();

  protected readonly terminalNameMax = TERMINAL_NAME_MAX;
  private setupSessionOpen = false;
  private readonly endSetupSession = (): void => this.closeSetupSession();

  protected readonly phase = signal<SetupPhase>('admin-login');
  protected readonly teams = signal<Team[]>([]);
  protected readonly loginError = signal<string | null>(null);
  protected readonly loggingIn = signal(false);
  protected readonly mfaPendingToken = signal<string | null>(null);
  protected readonly configError = signal<string | null>(null);
  protected readonly saving = signal(false);

  // Login form
  protected readonly emailControl = new FormControl('');
  protected readonly passwordControl = new FormControl('');
  protected readonly loginForm = new FormGroup({
    email: this.emailControl,
    password: this.passwordControl,
  });

  // Config form
  protected readonly terminalNameControl = new FormControl('');
  protected readonly teamControl = new FormControl<number | null>(null);
  protected readonly newTeamNameControl = new FormControl('');
  protected readonly showNewTeam = signal(false);

  protected readonly teamOptions = signal<{ value: unknown; label: string }[]>([]);
  protected readonly teamsLoaded = signal(false);
  protected readonly teamsLoadFailed = signal(false);
  protected readonly noTeams = computed(() => this.teamsLoaded() && this.teams().length === 0);

  private readonly terminalName = toSignal(this.terminalNameControl.valueChanges, { initialValue: '' });
  private readonly teamId = toSignal(this.teamControl.valueChanges, { initialValue: null });
  private readonly newTeamName = toSignal(this.newTeamNameControl.valueChanges, { initialValue: '' });

  protected readonly canActivate = computed(() => {
    if (this.saving() || !this.terminalName()?.trim()) return false;
    return this.showNewTeam() ? !!this.newTeamName()?.trim() : this.teamId() !== null;
  });

  // Teams list is gated — load after admin login in onLoginSubmit().

  protected onLoginSubmit(): void {
    const email = this.emailControl.value?.trim();
    const password = this.passwordControl.value;
    if (this.loggingIn() || !email || !password) return;

    this.loggingIn.set(true);
    this.loginError.set(null);

    this.authService.login({ email, password }).subscribe({
      next: (response) => {
        this.loggingIn.set(false);
        if (response.mfaRequired) {
          if (!response.mfaPendingToken) {
            this.loginError.set(this.translate.instant('shopFloor.invalidAdminCredentials'));
            return;
          }
          this.mfaPendingToken.set(response.mfaPendingToken);
          this.phase.set('mfa');
          return;
        }
        this.enterConfigure();
      },
      error: () => {
        this.loggingIn.set(false);
        this.loginError.set(this.translate.instant('shopFloor.invalidAdminCredentials'));
      },
    });
  }

  protected onMfaValidated(result: MfaValidateResponse): void {
    this.mfaPendingToken.set(null);
    this.loggingIn.set(true);
    this.authService.completeMfaLogin(result.accessToken, null).subscribe({
      next: () => {
        this.loggingIn.set(false);
        this.enterConfigure();
      },
      error: () => {
        this.loggingIn.set(false);
        this.authService.clearAuth();
        this.loginError.set(this.translate.instant('shopFloor.invalidAdminCredentials'));
        this.phase.set('admin-login');
      },
    });
  }

  ngOnDestroy(): void {
    this.closeSetupSession();
  }

  private enterConfigure(): void {
    if (!this.authService.hasAnyRole(SETUP_ROLES)) {
      this.authService.clearAuth();
      this.loginError.set(this.translate.instant('kioskSetup.needsAdminOrManager'));
      this.phase.set('admin-login');
      return;
    }
    this.setupSessionOpen = true;
    window.addEventListener('pagehide', this.endSetupSession);
    this.loadTeams();
    this.phase.set('configure');
  }

  private closeSetupSession(always = false): void {
    window.removeEventListener('pagehide', this.endSetupSession);
    if (!this.setupSessionOpen && !always) return;
    this.setupSessionOpen = false;
    this.authService.clearAuth();
  }

  protected onMfaCancelled(): void {
    this.mfaPendingToken.set(null);
    this.phase.set('admin-login');
  }

  protected toggleNewTeam(): void {
    if (this.noTeams()) return;
    this.showNewTeam.update(v => !v);
  }

  protected retryTeams(): void {
    this.loadTeams();
  }

  protected onSave(): void {
    const name = this.terminalNameControl.value?.trim();
    if (!name) {
      this.configError.set(this.translate.instant('shopFloor.terminalNameRequired'));
      return;
    }

    if (this.showNewTeam()) {
      this.createTeamThenSave(name);
    } else {
      const teamId = this.teamControl.value;
      if (!teamId) {
        this.configError.set(this.translate.instant('shopFloor.selectOrCreateTeam'));
        return;
      }
      this.saveTerminal(name, teamId);
    }
  }

  private createTeamThenSave(terminalName: string): void {
    const teamName = this.newTeamNameControl.value?.trim();
    if (!teamName) {
      this.configError.set(this.translate.instant('shopFloor.teamNameRequired'));
      return;
    }

    this.saving.set(true);
    this.configError.set(null);

    this.shopFloorService.createTeam(teamName).subscribe({
      next: (team) => {
        this.selectCreatedTeam(team);
        this.saveTerminal(terminalName, team.id);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.configError.set(httpProblemDetail(err) ?? this.translate.instant('shopFloor.createTeamFailed'));
      },
    });
  }

  private saveTerminal(name: string, teamId: number): void {
    this.saving.set(true);
    this.configError.set(null);

    let deviceToken: string;
    try {
      deviceToken = this.getDeviceToken();
    } catch {
      this.failSave();
      return;
    }

    this.shopFloorService.setupTerminal(name, deviceToken, teamId).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (terminal) => {
        try {
          localStorage.setItem('forge-kiosk-device-token', deviceToken);
          localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
        } catch {
          this.failSave();
          return;
        }
        this.closeSetupSession(true);
        this.configured.emit(terminal);
      },
      error: (err: unknown) => this.failSave(err),
    });
  }

  private failSave(err?: unknown): void {
    this.saving.set(false);
    this.configError.set(httpProblemDetail(err) ?? this.translate.instant('shopFloor.saveTerminalFailed'));
  }

  private selectCreatedTeam(team: Team): void {
    this.teams.update(teams => [...teams, team]);
    this.teamOptions.update(options => [...options, this.toTeamOption(team)]);
    this.teamControl.setValue(team.id);
    this.newTeamNameControl.setValue('');
    this.showNewTeam.set(false);
  }

  private toTeamOption(team: Team): { value: unknown; label: string } {
    return { value: team.id, label: `${team.name} (${team.memberCount} members)` };
  }

  private loadTeams(): void {
    this.teamsLoadFailed.set(false);
    this.shopFloorService.getTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.teamOptions.set(teams.map(t => this.toTeamOption(t)));
        this.teamsLoaded.set(true);
        if (teams.length === 0) this.showNewTeam.set(true);
      },
      error: () => this.teamsLoadFailed.set(true),
    });
  }

  private getDeviceToken(): string {
    let token = localStorage.getItem('forge-kiosk-device-token');
    if (!token) {
      token = randomId();
      localStorage.setItem('forge-kiosk-device-token', token);
    }
    return token;
  }
}
