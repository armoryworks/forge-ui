import { inject, Pipe, PipeTransform } from '@angular/core';

import { TerminologyService } from '../services/terminology.service';

@Pipe({
  name: 'terminology',
  standalone: true,
  pure: false,
})
export class TerminologyPipe implements PipeTransform {
  private readonly terminology = inject(TerminologyService);

  transform(key: string): string {
    return this.terminology.resolve(key);
  }
}
