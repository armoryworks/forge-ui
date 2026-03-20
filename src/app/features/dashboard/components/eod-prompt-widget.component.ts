import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { UserPreferencesService } from '../../../shared/services/user-preferences.service';

@Component({
  selector: 'app-eod-prompt-widget',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, TextareaComponent],
  templateUrl: './eod-prompt-widget.component.html',
  styleUrl: './eod-prompt-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodPromptWidgetComponent {
  private readonly prefs = inject(UserPreferencesService);

  private readonly todayKey = `eod:${new Date().toISOString().slice(0, 10)}`;

  readonly savedResponse = signal(this.prefs.get<string>(this.todayKey) ?? '');
  readonly isSaved = signal(!!this.savedResponse());
  readonly topThreeControl = new FormControl(this.savedResponse());

  save(): void {
    const value = this.topThreeControl.value ?? '';
    this.prefs.set(this.todayKey, value);
    this.savedResponse.set(value);
    this.isSaved.set(true);
  }

  edit(): void {
    this.isSaved.set(false);
  }
}
