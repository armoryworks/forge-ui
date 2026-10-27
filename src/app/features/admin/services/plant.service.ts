import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Plant } from '../models/plant.model';
import { PlantRequest } from '../models/plant-request.model';

@Injectable({ providedIn: 'root' })
export class PlantService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/plants`;

  list(): Observable<Plant[]> {
    return this.http.get<Plant[]>(this.base);
  }

  create(request: PlantRequest): Observable<Plant> {
    return this.http.post<Plant>(this.base, request);
  }

  update(id: number, request: PlantRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }
}
