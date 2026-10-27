import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { FileDownloadService } from '../services/file-download.service';
import { FileLinkDirective } from './file-link.directive';

@Component({
  standalone: true,
  imports: [FileLinkDirective],
  template: `<a data-testid="file-link" appFileLink="/api/v1/files/9/download" fileName="drawing.pdf" contentType="application/pdf">drawing.pdf</a>`,
})
class HostComponent {}

function setup(): { link: HTMLAnchorElement; open: ReturnType<typeof vi.fn>; openOrDownload: ReturnType<typeof vi.fn> } {
  TestBed.resetTestingModule();
  const open = vi.fn();
  const openOrDownload = vi.fn();
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: FileDownloadService, useValue: { open, openOrDownload } }],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const link = fixture.nativeElement.querySelector('[data-testid="file-link"]') as HTMLAnchorElement;
  return { link, open, openOrDownload };
}

describe('FileLinkDirective', () => {
  it('is a real link to the file', () => {
    expect(setup().link.getAttribute('href')).toBe('/api/v1/files/9/download');
  });

  it('opens or downloads the file on a plain click, without following the bare URL', () => {
    const { link, open, openOrDownload } = setup();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });

    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(openOrDownload).toHaveBeenCalledWith('/api/v1/files/9/download', 'drawing.pdf', 'application/pdf');
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the file in a new tab on a middle click', () => {
    const { link, open, openOrDownload } = setup();
    const middle = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });

    link.dispatchEvent(middle);

    expect(middle.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith('/api/v1/files/9/download', 'drawing.pdf');
    expect(openOrDownload).not.toHaveBeenCalled();
  });

  it('opens the file in a new tab on a Ctrl click', () => {
    const { link, open } = setup();

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true }));

    expect(open).toHaveBeenCalledWith('/api/v1/files/9/download', 'drawing.pdf');
  });

  it('leaves a right click to the browser menu', () => {
    const { link, open } = setup();
    const right = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 });

    link.dispatchEvent(right);

    expect(right.defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
