import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'mentionRender', standalone: true })
export class MentionRenderPipe implements PipeTransform {
  constructor(private readonly sanitizer: DomSanitizer) {}

  transform(content: string): SafeHtml {
    if (!content) return content;

    // Replace @[entityType:entityId:displayText] with styled chips
    const rendered = content.replace(
      /@\[(\w+):(\d+):([^\]]+)\]/g,
      (_match, type: string, id: string, display: string) => {
        const escaped = this.escapeHtml(display);
        return `<span class="mention-chip" data-entity-type="${type}" data-entity-id="${id}">@${escaped}</span>`;
      },
    );

    return this.sanitizer.bypassSecurityTrustHtml(rendered);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
