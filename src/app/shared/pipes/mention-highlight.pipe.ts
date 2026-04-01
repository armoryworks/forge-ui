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
    // Handle new structured format: @[Name](user:ID)
    const withNewMentions = escaped.replace(
      /@\[([^\]]+)\]\(user:(\d+)\)/g,
      '<span class="mention">@$1</span>',
    );
    // Handle legacy plain format: @username
    const highlighted = withNewMentions.replace(
      /@(\w+)/g,
      '<span class="mention">@$1</span>',
    );
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
