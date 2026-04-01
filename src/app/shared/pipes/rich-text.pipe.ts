import { inject, Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { marked } from 'marked';

@Pipe({
  name: 'richText',
  standalone: true,
})
export class RichTextPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return this.sanitizer.bypassSecurityTrustHtml('');

    // Replace @[Name](user:ID) before marked processes it — prevents marked from
    // interpreting the () as a link href (which DomSanitizer would strip).
    const withMentions = value.replace(
      /@\[([^\]]+)\]\(user:(\d+)\)/g,
      '<span class="mention" data-user-id="$2">@$1</span>',
    );

    // Replace [J-NNN](job:NNN) job-reference syntax with a styled span.
    const withJobRefs = withMentions.replace(
      /\[J-(\d+)\]\(job:(\d+)\)/g,
      '<span class="job-ref" data-job-id="$2">J-$1</span>',
    );

    const html = marked.parse(withJobRefs) as string;
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }
}
