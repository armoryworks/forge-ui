/**
 * Hands a fetched file (e.g. a server-rendered PDF) to the browser as a download named `fileName`.
 * The link is attached to the document for the click (detached links do not download in every browser),
 * and it and its object URL are released on the next tick, after the click has started the download.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  });
}
