import { Directive, HostBinding } from '@angular/core';

@Directive({
  selector: '[appSpacer]',
  standalone: true,
})
export class SpacerDirective {
  @HostBinding('style.flex') readonly flex = '1';
}
