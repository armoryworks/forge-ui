import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface AppVersion {
  version: string;
  sha: string;
}

export interface ServerVersion {
  version: string;
  shortCommit: string;
  buildLabel: string;
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly http = inject(HttpClient);

  readonly local = signal<AppVersion | null>(null);
  readonly server = signal<ServerVersion | null>(null);

  load(): void {
    this.http
      .get<AppVersion>('/assets/version.json')
      .pipe(catchError(() => of(null)))
      .subscribe(v => {
        if (v && v.sha && v.sha !== 'dev') {
          this.local.set({ ...v, sha: v.sha.slice(0, 7) });
        } else {
          this.local.set(v);
        }
      });
  }

  loadServer(): void {
    if (this.server()) return;
    this.http
      .get<ServerVersion>(`${environment.apiUrl}/version`)
      .pipe(catchError(() => of(null)))
      .subscribe(v => this.server.set(v));
  }
}
