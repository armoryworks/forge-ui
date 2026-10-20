import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { MentionRenderPipe } from './mention-render.pipe';

describe('MentionRenderPipe', () => {
  let pipe: MentionRenderPipe;
  let rendered: (content: string) => string;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [MentionRenderPipe] });
    pipe = TestBed.inject(MentionRenderPipe);
    const sanitizer = TestBed.inject(DomSanitizer);
    rendered = (content: string) => {
      const host = document.createElement('div');
      host.innerHTML = String(sanitizer.sanitize(1, pipe.transform(content) as SafeHtml) ?? '');
      return host.innerHTML;
    };
  });

  it('escapes an image tag with an onerror handler', () => {
    const html = rendered('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('escapes a script tag', () => {
    const html = rendered('hi <script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders a mention as a chip with its entity attributes', () => {
    const html = rendered('ping @[user:42:Ana Ruiz] now');
    expect(html).toContain('<span class="mention-chip" data-entity-type="user" data-entity-id="42">@Ana Ruiz</span>');
    expect(html.startsWith('ping ')).toBe(true);
  });

  it('escapes an ampersand in mention display text exactly once', () => {
    const html = rendered('@[customer:3:Smith & Sons]');
    expect(html).toContain('@Smith &amp; Sons</span>');
    expect(html).not.toContain('&amp;amp;');
  });

  it('keeps markup inside mention display text inert', () => {
    const html = rendered('@[user:1:<b onmouseover=x>Bo</b>]');
    expect(html).not.toContain('<b');
    expect(html).toContain('&lt;b onmouseover=x&gt;Bo&lt;/b&gt;');
  });

  it('returns empty content unchanged', () => {
    expect(pipe.transform('')).toBe('');
  });
});
