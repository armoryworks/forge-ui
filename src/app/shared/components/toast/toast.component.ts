import { ChangeDetectionStrategy, Component, ElementRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ToastService, Toast } from '../../services/toast.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-toast-container',
  imports: [TranslatePipe],
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { popover: 'manual' },
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialog = inject(MatDialog);
  private shownCount = 0;

  constructor() {
    effect(() => this.raise(this.toastService.toasts().length));
    this.dialog.afterOpened.pipe(takeUntilDestroyed()).subscribe(() => this.raiseAboveNewDialog());
  }

  protected iconFor(severity: Toast['severity']): string {
    switch (severity) {
      case 'info': return 'info';
      case 'success': return 'check_circle';
      case 'warning': return 'warning';
      case 'error': return 'error';
    }
  }

  private raise(count: number): void {
    const el = this.host.nativeElement;
    if (typeof el.showPopover !== 'function') return;
    const open = el.matches(':popover-open');
    if (count === 0) {
      if (open) el.hidePopover();
    } else if (!open || count > this.shownCount) {
      if (open) el.hidePopover();
      el.showPopover();
    }
    this.shownCount = count;
  }

  private raiseAboveNewDialog(): void {
    const el = this.host.nativeElement;
    if (typeof el.showPopover !== 'function' || !el.matches(':popover-open')) return;
    el.hidePopover();
    el.showPopover();
  }

  protected copy(toast: Toast): void {
    const text = [toast.title, toast.message, toast.details].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
  }
}
