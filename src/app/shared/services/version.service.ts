import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

export interface AppVersion {
  version: string;
  gitCommit: string;
  shortCommit: string;
  buildLabel: string;
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly http = inject(HttpClient);

  readonly info = signal<AppVersion | null>(null);
  readonly loaded = signal(false);

  load(): void {
    if (this.loaded()) return;
    this.http.get<AppVersion>(`${environment.apiUrl}/version`).subscribe({
      next: (data) => { this.info.set(data); this.loaded.set(true); },
      error: () => this.loaded.set(true), // silent fail — version is non-critical
    });
  }
}
