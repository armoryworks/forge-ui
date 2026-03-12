import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'mentionHighlight',
  standalone: true,
})
export class MentionHighlightPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(text: string): SafeHtml {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const highlighted = escaped.replace(
      /@(\w+)/g,
      '<span class="mention">@$1</span>',
    );
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
