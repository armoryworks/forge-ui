import { computed, contentChildren, Directive, ElementRef, forwardRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appTabList]',
  standalone: true,
  host: {
    role: 'tablist',
    '(keydown)': 'onKeydown($event)',
  },
})
export class TabListDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly tabs = contentChildren(forwardRef(() => TabDirective), { descendants: true });

  readonly focusableTab = computed(() => {
    const tabs = this.tabs();
    return tabs.find(tab => tab.appTab()) ?? tabs[0] ?? null;
  });

  onKeydown(event: KeyboardEvent): void {
    const tabs = Array.from(
      (this.el.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
    );
    const current = tabs.indexOf(event.target as HTMLElement);
    if (current < 0) return;

    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (current + 1) % tabs.length; break;
      case 'ArrowLeft': next = (current - 1 + tabs.length) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    tabs[next].focus();
  }
}

@Directive({
  selector: '[appTab]',
  standalone: true,
  host: {
    role: 'tab',
    type: 'button',
    '[class.tab--active]': 'appTab()',
    '[attr.aria-selected]': 'appTab()',
    '[attr.tabindex]': 'tabIndex()',
  },
})
export class TabDirective {
  private readonly list = inject(TabListDirective, { optional: true });

  readonly appTab = input.required<boolean>();

  protected readonly tabIndex = computed(() => {
    if (this.appTab()) return 0;
    return this.list?.focusableTab() === this ? 0 : -1;
  });
}
