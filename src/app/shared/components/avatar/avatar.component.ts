import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly initials = input.required<string>();
  readonly color = input<string>('#0d9488');
  readonly size = input<'sm' | 'md' | 'lg'>('sm');
}
