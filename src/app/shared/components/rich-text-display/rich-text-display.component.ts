import {
  ChangeDetectionStrategy,
  Component,
  SecurityContext,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { marked } from 'marked';

@Component({
  selector: 'app-rich-text-display',
  standalone: true,
  imports: [],
  templateUrl: './rich-text-display.component.html',
  styleUrl: './rich-text-display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextDisplayComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly content = input('');

  readonly jobRefClicked = output<string>();

  /** Pre-processes markdown mention/job-ref syntax → inline spans, then parses with marked. */
  protected readonly renderedHtml = computed((): SafeHtml => {
    const raw = this.content();
    if (!raw) return this.sanitizer.bypassSecurityTrustHtml('');

    // Replace @[Name](user:ID) with a styled span BEFORE marked touches it,
    // so marked doesn't interpret the () as a link href (which DomSanitizer strips).
    const withMentions = raw.replace(
      /@\[([^\]]+)\]\(user:(\d+)\)/g,
      '<span class="mention" data-user-id="$2">@$1</span>',
    );

    // Replace [J-NNN](job:NNN) job-reference links similarly.
    const withJobRefs = withMentions.replace(
      /\[J-(\d+)\]\(job:(\d+)\)/g,
      '<span class="job-ref" data-job-id="$2">J-$1</span>',
    );

    const html = marked.parse(withJobRefs) as string;

    // sanitize to prevent XSS while keeping our safe span markup
    const sanitized =
      this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';

    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  });

  protected onContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('job-ref')) {
      // Extract job number from text content (e.g. "J-1050")
      const jobNumber = target.textContent?.trim() ?? '';
      if (jobNumber) {
        this.jobRefClicked.emit(jobNumber);
      }
    }
  }
}
