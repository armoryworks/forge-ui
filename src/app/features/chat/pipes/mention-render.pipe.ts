import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

@Pipe({ name: 'mentionRender', standalone: true })
export class MentionRenderPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(content: string): SafeHtml {
    if (!content) return content;

    // Replace @[entityType:entityId:displayText] with styled chips
    const rendered = this.escapeHtml(content).replace(
      /@\[(\w+):(\d+):([^\]]+)\]/g,
      (_match, type: string, id: string, display: string) =>
        `<span class="mention-chip" data-entity-type="${type}" data-entity-id="${id}">@${display}</span>`,
    );

    return this.sanitizer.bypassSecurityTrustHtml(rendered);
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
  }
}
