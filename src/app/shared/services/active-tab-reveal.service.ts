import { DOCUMENT, Injectable, Injector, afterNextRender, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

const SETTLE_MS = 400;

/**
 * Keeps the active tab of every horizontally scrolling `.tab-bar` in view.
 *
 * A deep link to a far tab (e.g. `/quality/gages` on a narrow screen) renders the bar
 * scrolled to the start, so the active tab sits off-screen. After each navigation the
 * service scrolls each overflowing bar just far enough to show its `.tab--active` tab.
 */
@Injectable({ providedIn: 'root' })
export class ActiveTabRevealService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** Starts revealing active tabs after every navigation; unsubscribe to stop. */
  watch(): Subscription {
    return this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      afterNextRender(() => {
        this.reveal();
        setTimeout(() => this.reveal(), SETTLE_MS);
      }, { injector: this.injector });
    });
  }

  /** Scrolls each overflowing tab bar under `root` so its active tab is fully visible. */
  reveal(root: ParentNode = this.document): void {
    for (const tab of Array.from(root.querySelectorAll<HTMLElement>('.tab-bar > .tab--active'))) {
      const bar = tab.parentElement;
      if (!bar || bar.scrollWidth <= bar.clientWidth) continue;
      const barRect = bar.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      if (tabRect.left < barRect.left) {
        bar.scrollLeft -= barRect.left - tabRect.left;
      } else if (tabRect.right > barRect.right) {
        bar.scrollLeft += tabRect.right - barRect.right;
      }
    }
  }
}
