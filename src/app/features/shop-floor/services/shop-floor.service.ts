import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ShopFloorOverview } from '../models/shop-floor-overview.model';

@Injectable({ providedIn: 'root' })
export class ShopFloorService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<ShopFloorOverview> {
    return this.http.get<ShopFloorOverview>('/api/v1/display/shop-floor');
  }
}
