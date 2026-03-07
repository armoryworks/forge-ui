import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { TeamMember } from '../models/dashboard.model';

@Component({
  selector: 'app-team-load-widget',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './team-load-widget.component.html',
  styleUrl: './team-load-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamLoadWidgetComponent {
  readonly team = input.required<TeamMember[]>();
}
