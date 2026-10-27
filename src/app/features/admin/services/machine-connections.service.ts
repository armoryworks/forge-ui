import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  MachineConnection,
  MachineConnectionTestResult,
  SaveMachineConnectionRequest,
  WorkCenterOption,
} from '../models/machine-connection.model';

@Injectable({ providedIn: 'root' })
export class MachineConnectionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/machine-connections`;

  list(): Observable<MachineConnection[]> {
    return this.http.get<MachineConnection[]>(this.base);
  }

  create(request: SaveMachineConnectionRequest): Observable<MachineConnection> {
    return this.http.post<MachineConnection>(this.base, request);
  }

  update(id: number, request: SaveMachineConnectionRequest): Observable<MachineConnection> {
    return this.http.put<MachineConnection>(`${this.base}/${id}`, request);
  }

  test(id: number): Observable<MachineConnectionTestResult> {
    return this.http.post<MachineConnectionTestResult>(`${this.base}/${id}/test`, {});
  }

  workCenters(): Observable<WorkCenterOption[]> {
    return this.http.get<WorkCenterOption[]>(`${environment.apiUrl}/work-centers`);
  }
}
