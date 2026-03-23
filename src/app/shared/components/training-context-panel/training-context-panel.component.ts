import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';

import { environment } from '../../../../environments/environment';

export interface TrainingContextCard {
  id: number;
  title: string;
  summary: string;
  contentType: string;
  estimatedMinutes: number;
  myStatus: string | null;
  appRoute: string;
}

@Component({
  selector: 'app-training-context-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './training-context-panel.component.html',
  styleUrl: './training-context-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingContextPanelComponent {
  private readonly http = inject(HttpClient);

  readonly currentRoute = input.required<string>();
  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly modules = signal<TrainingContextCard[]>([]);
  protected readonly isLoading = signal(false);

  constructor() {
    effect(() => {
      const route = this.currentRoute();
      const isOpen = this.open();
      if (isOpen && route) {
        this.loadModules(route);
      }
    });
  }

  private loadModules(route: string): void {
    this.isLoading.set(true);
    const params = new HttpParams().set('route', route);
    this.http.get<TrainingContextCard[]>(`${environment.apiUrl}/training/modules/by-route`, { params })
      .subscribe({
        next: modules => {
          this.modules.set(modules);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected contentTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      Article: 'article',
      Video: 'play_circle',
      Walkthrough: 'route',
      QuickRef: 'quick_reference_all',
      Quiz: 'quiz',
    };
    return icons[type] ?? 'school';
  }
}
