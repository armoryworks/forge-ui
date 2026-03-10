import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { QRCodeComponent as QRCode } from 'angularx-qrcode';

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [QRCode],
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCodeComponent {
  readonly value = input.required<string>();
  readonly size = input<number>(128);
  readonly errorCorrectionLevel = input<'L' | 'M' | 'Q' | 'H'>('M');
}
