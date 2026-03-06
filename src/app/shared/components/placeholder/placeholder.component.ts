import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  templateUrl: './placeholder.component.html',
  styleUrl: './placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderComponent {
  protected readonly featureName =
    inject(ActivatedRoute).snapshot.data['featureName'] ?? 'Feature';
}
