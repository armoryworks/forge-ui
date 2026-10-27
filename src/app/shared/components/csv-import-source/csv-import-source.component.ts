import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { TextareaComponent } from '../textarea/textarea.component';

/**
 * The "choose your data" step of a CSV import page: upload a .csv file or paste comma- or tab-separated
 * rows (header row first), plus a button that downloads a template with the expected headers. Emits the raw
 * text; the page parses and maps it.
 */
@Component({
  selector: 'app-csv-import-source',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, TextareaComponent],
  templateUrl: './csv-import-source.component.html',
  styleUrl: './csv-import-source.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvImportSourceComponent {
  readonly hint = input<string>('');
  readonly errors = input<string[]>([]);
  readonly hasRows = input(false);
  readonly testIdPrefix = input('import');

  readonly textLoaded = output<string>();
  readonly templateRequested = output<void>();
  readonly resetRequested = output<void>();

  protected readonly pasteControl = new FormControl<string>('', { nonNullable: true });

  protected onFileChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.textLoaded.emit(String(reader.result ?? ''));
    reader.onerror = () => this.textLoaded.emit('');
    reader.readAsText(file);
    el.value = '';
  }

  protected parsePasted(): void {
    this.textLoaded.emit(this.pasteControl.value);
  }

  protected reset(): void {
    this.pasteControl.setValue('');
    this.resetRequested.emit();
  }
}
