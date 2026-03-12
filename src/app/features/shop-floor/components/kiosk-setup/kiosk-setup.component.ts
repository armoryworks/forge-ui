import {
  ChangeDetectionStrategy, Component, inject, OnInit, output, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KioskTerminal, Team } from '../../models/kiosk-terminal.model';

type SetupPhase = 'admin-login' | 'configure';

@Component({
  selector: 'app-kiosk-setup',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, SelectComponent],
  templateUrl: './kiosk-setup.component.html',
  styleUrl: './kiosk-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskSetupComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly shopFloorService = inject(ShopFloorService);

  readonly configured = output<KioskTerminal>();

  protected readonly phase = signal<SetupPhase>('admin-login');
  protected readonly teams = signal<Team[]>([]);
  protected readonly loginError = signal<string | null>(null);
  protected readonly loggingIn = signal(false);
  protected readonly configError = signal<string | null>(null);
  protected readonly saving = signal(false);

  // Login form
  protected readonly emailControl = new FormControl('');
  protected readonly passwordControl = new FormControl('');

  // Config form
  protected readonly terminalNameControl = new FormControl('');
  protected readonly teamControl = new FormControl<number | null>(null);
  protected readonly newTeamNameControl = new FormControl('');
  protected readonly showNewTeam = signal(false);

  protected readonly teamOptions = signal<{ value: unknown; label: string }[]>([]);

  ngOnInit(): void {
    // Try loading teams without auth first (endpoint is AllowAnonymous)
    this.loadTeams();
  }

  protected onLoginSubmit(): void {
    const email = this.emailControl.value?.trim();
    const password = this.passwordControl.value;
    if (!email || !password) {
      this.loginError.set('Email and password are required.');
      return;
    }

    this.loggingIn.set(true);
    this.loginError.set(null);

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.loggingIn.set(false);
        this.loadTeams();
        this.phase.set('configure');
      },
      error: () => {
        this.loggingIn.set(false);
        this.loginError.set('Invalid credentials. Admin access required.');
      },
    });
  }

  protected toggleNewTeam(): void {
    this.showNewTeam.update(v => !v);
  }

  protected onSave(): void {
    const name = this.terminalNameControl.value?.trim();
    if (!name) {
      this.configError.set('Terminal name is required.');
      return;
    }

    if (this.showNewTeam()) {
      this.createTeamThenSave(name);
    } else {
      const teamId = this.teamControl.value;
      if (!teamId) {
        this.configError.set('Select a team or create a new one.');
        return;
      }
      this.saveTerminal(name, teamId);
    }
  }

  private createTeamThenSave(terminalName: string): void {
    const teamName = this.newTeamNameControl.value?.trim();
    if (!teamName) {
      this.configError.set('Team name is required.');
      return;
    }

    this.saving.set(true);
    this.configError.set(null);

    this.shopFloorService.createTeam(teamName).subscribe({
      next: (team) => {
        this.saveTerminal(terminalName, team.id);
      },
      error: () => {
        this.saving.set(false);
        this.configError.set('Failed to create team.');
      },
    });
  }

  private saveTerminal(name: string, teamId: number): void {
    this.saving.set(true);
    this.configError.set(null);

    const deviceToken = this.getDeviceToken();

    this.shopFloorService.setupTerminal(name, deviceToken, teamId).subscribe({
      next: (terminal) => {
        this.saving.set(false);
        localStorage.setItem('qbe-kiosk-device-token', deviceToken);
        localStorage.setItem('qbe-kiosk-terminal', JSON.stringify(terminal));
        this.authService.clearAuth(); // Clear admin session
        this.configured.emit(terminal);
      },
      error: () => {
        this.saving.set(false);
        this.configError.set('Failed to save terminal configuration.');
      },
    });
  }

  private loadTeams(): void {
    this.shopFloorService.getTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.teamOptions.set(
          teams.map(t => ({ value: t.id, label: `${t.name} (${t.memberCount} members)` })),
        );
      },
    });
  }

  private getDeviceToken(): string {
    let token = localStorage.getItem('qbe-kiosk-device-token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('qbe-kiosk-device-token', token);
    }
    return token;
  }
}
