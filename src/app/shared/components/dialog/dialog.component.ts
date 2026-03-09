import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-dialog',
  standalone: true,
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <div class="dialog" [style.width]="width()" (click)="$event.stopPropagation()">
        <div class="dialog__header">
          <span class="dialog__title">{{ title() }}</span>
          <button class="icon-btn" (click)="closed.emit()">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <div class="dialog__body">
          <ng-content />
        </div>
        <div class="dialog__footer">
          <ng-content select="[dialog-footer]" />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  readonly title = input.required<string>();
  readonly width = input<string>('420px');
  readonly closed = output<void>();
}
