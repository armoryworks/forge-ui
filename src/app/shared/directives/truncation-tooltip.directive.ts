import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

import { MatTooltip } from '@angular/material/tooltip';

@Directive({
  selector: '[appTruncationTooltip]',
  standalone: true,
  hostDirectives: [MatTooltip],
})
export class TruncationTooltipDirective {
  @Input('appTruncationTooltip') text = '';

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly tooltip = inject(MatTooltip);

  @HostListener('mouseenter')
  onMouseEnter(): void {
    const el = this.el.nativeElement;
    const truncated = el.scrollWidth > el.offsetWidth;
    this.tooltip.message = truncated ? this.text : '';
    this.tooltip.disabled = !truncated;
  }
}
