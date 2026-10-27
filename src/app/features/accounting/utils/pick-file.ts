/** Opens the browser's file chooser for one file of the `accept` types and hands the chosen file to `onPicked`. */
export function pickFile(accept: string, onPicked: (file: File) => void): void {
  const chooser = document.createElement('input');
  chooser.type = 'file';
  chooser.accept = accept;
  chooser.addEventListener('change', () => {
    const file = chooser.files?.[0];
    if (file) onPicked(file);
  }, { once: true });
  chooser.click();
}
