import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: '[appRowExpand]',
  standalone: true,
})
export class RowExpandDirective {
  constructor(public template: TemplateRef<unknown>) {}
}
