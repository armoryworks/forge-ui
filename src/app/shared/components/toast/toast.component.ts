import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
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
