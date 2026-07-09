import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CustomerSegment, CustomerSegmentRequest } from '../models/customer-segment.model';

/** C3: customer segments (saved named filters) CRUD. Mutations are Admin/Manager server-side. */
@Injectable({ providedIn: 'root' })
export class CustomerSegmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customers/segments`;

  getSegments(): Observable<CustomerSegment[]> {
    return this.http.get<CustomerSegment[]>(this.base);
  }

  createSegment(body: CustomerSegmentRequest): Observable<CustomerSegment> {
    return this.http.post<CustomerSegment>(this.base, body);
  }

  updateSegment(id: number, body: CustomerSegmentRequest): Observable<CustomerSegment> {
    return this.http.put<CustomerSegment>(`${this.base}/${id}`, body);
  }

  deleteSegment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
