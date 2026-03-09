import { Directive, input, TemplateRef } from '@angular/core';

@Directive({
  selector: '[appColumnCell]',
  standalone: true,
})
export class ColumnCellDirective {
  readonly field = input.required<string>({ alias: 'appColumnCell' });

  constructor(public template: TemplateRef<unknown>) {}
}
