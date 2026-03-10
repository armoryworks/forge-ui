import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [NgxExtendedPdfViewerModule],
  templateUrl: './pdf-viewer.component.html',
  styleUrl: './pdf-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfViewerComponent {
  readonly src = input.required<string | Uint8Array>();
  readonly height = input<string>('600px');
  readonly showToolbar = input<boolean>(true);
  readonly showSidebarButton = input<boolean>(false);
  readonly closed = output<void>();
}
