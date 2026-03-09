import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SearchResult } from '../models/search.model';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);

  search(term: string, limit: number = 20): Observable<SearchResult[]> {
    return this.http.get<SearchResult[]>(`${environment.apiUrl}/search`, {
      params: { q: term, limit: limit.toString() },
    });
  }
}
