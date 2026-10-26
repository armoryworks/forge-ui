import { downloadBlob } from './download-blob';

const FRAME_LIFETIME_MS = 60_000;

/**
 * Opens the browser's print dialog for a fetched PDF without leaving the page: the PDF loads in a hidden
 * frame whose own print() is called once it has rendered. Kiosk browsers often block new tabs, so this is
 * the print path for the shop floor. When the frame cannot print (no PDF viewer, or a browser that refuses
 * scripted printing of a PDF frame) the file is downloaded as `fileName` instead.
 */
export function printPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.visibility = 'hidden';
  const release = () => {
    frame.remove();
    URL.revokeObjectURL(url);
  };
  frame.addEventListener('load', () => {
    const view = frame.contentWindow;
    try {
      view?.focus();
      view?.print();
      setTimeout(release, FRAME_LIFETIME_MS);
    } catch {
      release();
      downloadBlob(blob, fileName);
    }
  }, { once: true });
  frame.src = url;
  document.body.appendChild(frame);
}
