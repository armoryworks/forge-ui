import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { LoadingService } from '../../shared/services/loading.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-loading-demo',
  standalone: true,
  imports: [PageHeaderComponent, LoadingBlockDirective],
  templateUrl: './loading-demo.component.html',
  styleUrl: './loading-demo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingDemoComponent {
  private readonly loadingService = inject(LoadingService);

  protected readonly blockLoading = signal(false);
  protected readonly blockLoading2 = signal(false);

  protected triggerGlobal(durationMs: number, message: string): void {
    this.loadingService.start('demo', message);
    setTimeout(() => this.loadingService.stop('demo'), durationMs);
  }

  protected triggerAllAtOnce(): void {
    this.loadingService.start('sim-1', 'Loading parts...');
    this.loadingService.start('sim-2', 'Loading inventory...');
    this.loadingService.start('sim-3', 'Syncing data...');
    setTimeout(() => this.loadingService.stop('sim-1'), 2000);
    setTimeout(() => this.loadingService.stop('sim-2'), 3000);
    setTimeout(() => this.loadingService.stop('sim-3'), 4000);
  }

  protected triggerStaggered(): void {
    this.loadingService.start('cause-1', 'Loading parts...');
    setTimeout(() => {
      this.loadingService.start('cause-2', 'Loading inventory...');
    }, 800);
    setTimeout(() => this.loadingService.stop('cause-1'), 1500);
    setTimeout(() => {
      this.loadingService.start('cause-3', 'Syncing data...');
    }, 2000);
    setTimeout(() => this.loadingService.stop('cause-2'), 2500);
    setTimeout(() => this.loadingService.stop('cause-3'), 3500);
  }

  protected toggleBlock(which: 'a' | 'b'): void {
    const sig = which === 'a' ? this.blockLoading : this.blockLoading2;
    sig.update(v => !v);
  }
}
