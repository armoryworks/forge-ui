/**
 * Hands a fetched file (e.g. a server-rendered PDF) to the browser as a download named `fileName`.
 * The object URL is released on the next tick, after the click has started the download.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
