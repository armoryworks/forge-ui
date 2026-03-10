import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-markdown-view',
  standalone: true,
  imports: [MarkdownComponent],
  templateUrl: './markdown-view.component.html',
  styleUrl: './markdown-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownViewComponent {
  readonly content = input.required<string>();
}
