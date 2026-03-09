import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    @for (toast of toastService.toasts(); track toast.id) {
      <div class="toast toast--{{ toast.severity }}">
        <span class="material-icons-outlined toast__icon">{{ iconFor(toast.severity) }}</span>
        <div class="toast__body">
          <strong class="toast__title">{{ toast.title }}</strong>
          @if (toast.message) {
            <p class="toast__message">{{ toast.message }}</p>
          }
          @if (toast.details) {
            <pre class="toast__details">{{ toast.details }}</pre>
          }
        </div>
        <div class="toast__actions">
          <button class="toast__btn" (click)="copy(toast)" title="Copy">
            <span class="material-icons-outlined">content_copy</span>
          </button>
          <button class="toast__btn" (click)="toastService.dismiss(toast.id)" title="Dismiss">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    @use 'styles/variables' as *;

    :host {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: $z-toast;
      display: flex;
      flex-direction: column;
      gap: $sp-md;
      max-width: 400px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: $sp-md;
      padding: $sp-md $sp-lg;
      background: var(--surface);
      border: $border-width-thin solid var(--border);
      font-size: $font-size-sm;
      pointer-events: auto;

      &--info { border-left: 3px solid var(--info); }
      &--success { border-left: 3px solid var(--success); }
      &--warning { border-left: 3px solid var(--warning); }
      &--error { border-left: 3px solid var(--error); }
    }

    .toast__icon {
      font-size: 16px;
      margin-top: 1px;
    }

    .toast--info .toast__icon { color: var(--info); }
    .toast--success .toast__icon { color: var(--success); }
    .toast--warning .toast__icon { color: var(--warning); }
    .toast--error .toast__icon { color: var(--error); }

    .toast__body {
      flex: 1;
      min-width: 0;
    }

    .toast__title {
      font-weight: 600;
      color: var(--text);
    }

    .toast__message {
      margin: $sp-xs 0 0;
      color: var(--text-secondary);
    }

    .toast__details {
      margin: $sp-sm 0 0;
      padding: $sp-sm;
      background: var(--bg);
      font-family: $font-family-mono;
      font-size: $font-size-xs;
      color: var(--text-muted);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 120px;
      overflow-y: auto;
    }

    .toast__actions {
      display: flex;
      gap: $sp-xs;
    }

    .toast__btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: $sp-xs;
      color: var(--text-muted);
      line-height: 1;

      .material-icons-outlined { font-size: 14px; }

      &:hover { color: var(--text); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);

  protected iconFor(severity: Toast['severity']): string {
    switch (severity) {
      case 'info': return 'info';
      case 'success': return 'check_circle';
      case 'warning': return 'warning';
      case 'error': return 'error';
    }
  }

  protected copy(toast: Toast): void {
    const text = [toast.title, toast.message, toast.details].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
  }
}
