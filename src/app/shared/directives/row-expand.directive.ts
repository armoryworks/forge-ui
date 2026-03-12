import { Directive, inject, TemplateRef } from '@angular/core';

@Directive({
  selector: '[appRowExpand]',
  standalone: true,
})
export class RowExpandDirective {
  readonly template = inject(TemplateRef<unknown>);
}
