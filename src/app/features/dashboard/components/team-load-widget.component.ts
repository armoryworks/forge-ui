import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { TeamMember } from '../models/dashboard.model';
import { MOCK_TEAM } from '../services/dashboard-mock.data';

@Component({
  selector: 'app-team-load-widget',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './team-load-widget.component.html',
  styleUrl: './team-load-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamLoadWidgetComponent {
  protected readonly team = signal<TeamMember[]>(MOCK_TEAM);
}
