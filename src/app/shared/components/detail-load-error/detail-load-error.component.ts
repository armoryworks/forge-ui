import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { TranslatePipe } from '@ngx-translate/core';

import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-detail-load-error',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent],
  templateUrl: './detail-load-error.component.html',
  styleUrl: './detail-load-error.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailLoadErrorComponent {
  readonly error = input<unknown>(null);
  readonly closed = output<void>();

  protected readonly kind = computed<'notFound' | 'forbidden' | 'failed'>(() => {
    const err = this.error();
    if (err instanceof HttpErrorResponse) {
      if (err.status === 404) return 'notFound';
      if (err.status === 403) return 'forbidden';
    }
    return 'failed';
  });

  protected readonly view = computed(() => {
    switch (this.kind()) {
      case 'notFound':
        return { icon: 'search_off', message: 'detailLoadError.notFound', help: 'detailLoadError.notFoundHelp' };
      case 'forbidden':
        return { icon: 'lock', message: 'detailLoadError.forbidden', help: 'detailLoadError.forbiddenHelp' };
      default:
        return { icon: 'error_outline', message: 'detailLoadError.failed', help: 'detailLoadError.failedHelp' };
    }
  });
}
