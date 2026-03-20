import { Injectable } from '@angular/core';

export interface LabelData {
  type: 'barcode' | 'qr';
  value: string;
  label?: string;
  sublabel?: string;
  width?: number;
  height?: number;
}

@Injectable({ providedIn: 'root' })
export class LabelPrintService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lazy-loaded third-party
  private bwipJs: any = null;

  async generateBarcodeDataUrl(value: string, bcid = 'code128', scale = 4): Promise<string> {
    const bwip = await this.loadBwipJs();
    const canvas = document.createElement('canvas');
    bwip.toCanvas(canvas, {
      bcid,
      text: value,
      scale,
      height: 12,
      includetext: true,
      textxalign: 'center',
      backgroundcolor: 'ffffff',
    });
    return canvas.toDataURL('image/png');
  }

  async generateQrDataUrl(value: string, scale = 4): Promise<string> {
    const bwip = await this.loadBwipJs();
    const canvas = document.createElement('canvas');
    bwip.toCanvas(canvas, {
      bcid: 'qrcode',
      text: value,
      scale,
      height: 30,
      width: 30,
      backgroundcolor: 'ffffff',
    });
    return canvas.toDataURL('image/png');
  }

  async printLabels(labels: LabelData[]): Promise<void> {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const imagePromises = labels.map(async (label) => {
      const dataUrl = label.type === 'qr'
        ? await this.generateQrDataUrl(label.value)
        : await this.generateBarcodeDataUrl(label.value);
      return { ...label, dataUrl };
    });

    const resolved = await Promise.all(imagePromises);

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Print Labels</title>
  <style>
    @page { margin: 8mm; }
    body { margin: 0; font-family: 'IBM Plex Mono', monospace; }
    .label { display: inline-block; text-align: center; padding: 4mm; page-break-inside: avoid; border: 1px dashed #ccc; margin: 2mm; }
    .label img { display: block; margin: 0 auto 2mm; max-width: 100%; height: auto; image-rendering: pixelated; }
    .label-text { font-size: 10pt; font-weight: 600; }
    .label-subtext { font-size: 8pt; color: #666; }
    @media print { .label { border: none; } }
  </style>
</head>
<body>
  ${resolved.map(l => `
    <div class="label" style="width:${l.width ?? 50}mm;">
      <img src="${l.dataUrl}" alt="${l.value}" />
      ${l.label ? `<div class="label-text">${l.label}</div>` : ''}
      ${l.sublabel ? `<div class="label-subtext">${l.sublabel}</div>` : ''}
    </div>
  `).join('')}
  <script>
    var imgs = document.querySelectorAll('img');
    var loaded = 0;
    function checkPrint() { if (++loaded >= imgs.length) setTimeout(function() { window.print(); }, 100); }
    imgs.forEach(function(img) {
      if (img.complete) checkPrint();
      else img.onload = checkPrint;
    });
    if (imgs.length === 0) window.print();
  </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lazy-loaded third-party
  private async loadBwipJs(): Promise<any> {
    if (!this.bwipJs) {
      this.bwipJs = await import(/* webpackChunkName: "bwip-js" */ 'bwip-js');
    }
    return this.bwipJs;
  }
}
