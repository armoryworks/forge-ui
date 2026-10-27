import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Configurator } from '../models/configurator.model';
import { ConfiguratorDetail } from '../models/configurator-detail.model';
import { ConfiguratorRequest } from '../models/configurator-request.model';
import { CpqResult } from '../models/cpq-result.model';
import { ProductConfiguration } from '../models/product-configuration.model';

/** Configure-price-quote: configurators, live pricing, saved configurations and the quotes and parts made from them. */
@Injectable({ providedIn: 'root' })
export class CpqService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cpq`;

  getConfigurators(isActive?: boolean): Observable<Configurator[]> {
    let params = new HttpParams();
    if (isActive !== undefined) params = params.set('isActive', isActive);
    return this.http.get<Configurator[]>(`${this.base}/configurators`, { params });
  }

  getConfigurator(id: number): Observable<ConfiguratorDetail> {
    return this.http.get<ConfiguratorDetail>(`${this.base}/configurators/${id}`);
  }

  createConfigurator(body: ConfiguratorRequest): Observable<Configurator> {
    return this.http.post<Configurator>(`${this.base}/configurators`, body);
  }

  updateConfigurator(id: number, body: ConfiguratorRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/configurators/${id}`, body);
  }

  configure(configuratorId: number, selections: Record<string, string>, quantity: number): Observable<CpqResult> {
    return this.http.post<CpqResult>(`${this.base}/configure`, { configuratorId, selections, quantity });
  }

  saveConfiguration(configuratorId: number, selections: Record<string, string>, quantity: number): Observable<ProductConfiguration> {
    return this.http.post<ProductConfiguration>(`${this.base}/configurations`, { configuratorId, selections, quantity });
  }

  generateQuote(configurationId: number, customerId: number, createPart: boolean): Observable<{ quoteId: number }> {
    return this.http.post<{ quoteId: number }>(`${this.base}/configurations/${configurationId}/generate-quote`, { customerId, createPart });
  }

  generatePart(configurationId: number): Observable<{ partId: number }> {
    return this.http.post<{ partId: number }>(`${this.base}/configurations/${configurationId}/generate-part`, {});
  }
}
