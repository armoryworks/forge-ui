import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-detail-side-panel',
  standalone: true,
  templateUrl: './detail-side-panel.component.html',
  styleUrl: './detail-side-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailSidePanelComponent {
  readonly open = input.required<boolean>();
  readonly title = input<string>('');

  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }

  onBackdropClick(): void {
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
