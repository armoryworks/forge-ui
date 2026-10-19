import { inject, Pipe, PipeTransform } from '@angular/core';

import { TerminologyService } from '../services/terminology.service';

/**
 * Applies the install's term renames to English text the server composed
 * (activity entries, calendar events, AI starter prompts), so rows written
 * before a rename read the same as the rest of the app. Not for text a
 * person typed.
 */
@Pipe({
  name: 'termText',
  standalone: true,
  pure: false,
})
export class TermTextPipe implements PipeTransform {
  private readonly terminology = inject(TerminologyService);

  transform(text: string | null | undefined): string {
    this.terminology.labels();
    return text ? this.terminology.substitute(text, 'en') : '';
  }
}
