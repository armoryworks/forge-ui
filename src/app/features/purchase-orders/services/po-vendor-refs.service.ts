import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';
import { PoVendorRef } from '../models/po-vendor-ref.model';

const ORDER_FROM = 'OrderFrom';

@Injectable({ providedIn: 'root' })
export class PoVendorRefsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getContacts(vendorId: number): Observable<PoVendorRef[]> {
    return this.http.get<{
      id: number; firstName: string; lastName: string; role: string | null; isPrimary: boolean; isActive?: boolean;
    }[]>(`${this.base}/vendors/${vendorId}/contacts`, this.silent()).pipe(
      map(rows => {
        const active = rows.filter(c => c.isActive !== false);
        return active.map(c => {
          const name = `${c.firstName} ${c.lastName}`.trim();
          return {
            id: c.id,
            label: c.role ? `${name} (${c.role})` : name,
            isDefault: c.isPrimary || active.length === 1,
          };
        });
      }),
      catchError(() => of([])),
    );
  }

  getOrderFromAddresses(vendorId: number): Observable<PoVendorRef[]> {
    return this.http.get<{
      id: number; addressType: string; label: string | null; line1: string; city: string; state: string;
      isDefault: boolean; isActive?: boolean;
    }[]>(`${this.base}/vendors/${vendorId}/addresses`, this.silent()).pipe(
      map(rows => {
        const active = rows.filter(a => a.isActive !== false);
        const orderFrom = active.filter(a => a.addressType === ORDER_FROM);
        const onlyOrderFrom = orderFrom.length === 1 ? orderFrom[0].id : null;
        const defaultId = orderFrom.find(a => a.isDefault)?.id ?? onlyOrderFrom;
        return [...orderFrom, ...active.filter(a => a.addressType !== ORDER_FROM)].map(a => {
          const street = `${a.line1}, ${a.city}, ${a.state}`;
          return {
            id: a.id,
            label: a.label ? `${a.label}: ${street}` : street,
            isDefault: a.id === defaultId,
          };
        });
      }),
      catchError(() => of([])),
    );
  }

  getShipToLocations(): Observable<PoVendorRef[]> {
    return this.http.get<{
      id: number; name: string; city: string; state: string; isDefault: boolean; isActive: boolean;
    }[]>(`${this.base}/company-locations`, this.silent()).pipe(
      map(rows => {
        const active = rows.filter(l => l.isActive);
        return active.map(l => ({
          id: l.id,
          label: `${l.name} (${l.city}, ${l.state})`,
          isDefault: l.isDefault || active.length === 1,
        }));
      }),
      catchError(() => of([])),
    );
  }

  private silent(): { context: HttpContext } {
    return { context: new HttpContext().set(SILENT_HTTP_ERRORS, true) };
  }
}
