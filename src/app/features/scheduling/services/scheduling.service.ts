import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  CreateShiftRequest,
  CreateWorkCenterRequest,
  DispatchListItem,
  RunSchedulerRequest,
  ScheduledOperation,
  ScheduleRun,
  Shift,
  WorkCenter,
  WorkCenterLoad,
} from '../models/scheduling.model';

@Injectable({ providedIn: 'root' })
export class SchedulingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  // Scheduling runs
  runScheduler(request: RunSchedulerRequest) {
    return this.http.post<ScheduleRun>(`${this.baseUrl}/scheduling/run`, request);
  }

  simulateSchedule(request: RunSchedulerRequest) {
    return this.http.post<ScheduleRun>(`${this.baseUrl}/scheduling/simulate`, request);
  }

  getScheduleRuns() {
    return this.http.get<ScheduleRun[]>(`${this.baseUrl}/scheduling/runs`);
  }

  // Gantt data
  getGanttData(from: string, to: string) {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<ScheduledOperation[]>(`${this.baseUrl}/scheduling/gantt`, { params });
  }

  // Operations
  rescheduleOperation(id: number, newStart: string) {
    return this.http.patch(`${this.baseUrl}/scheduling/operations/${id}`, { newStart });
  }

  lockOperation(id: number, isLocked: boolean) {
    return this.http.post(`${this.baseUrl}/scheduling/operations/${id}/lock`, { isLocked });
  }

  // Dispatch
  getDispatchList(workCenterId: number) {
    return this.http.get<DispatchListItem[]>(`${this.baseUrl}/scheduling/dispatch/${workCenterId}`);
  }

  // Work center load
  getWorkCenterLoad(workCenterId: number, from: string, to: string) {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<WorkCenterLoad>(`${this.baseUrl}/scheduling/work-center-load/${workCenterId}`, { params });
  }

  // Work centers
  getWorkCenters() {
    return this.http.get<WorkCenter[]>(`${this.baseUrl}/work-centers`);
  }

  createWorkCenter(request: CreateWorkCenterRequest) {
    return this.http.post<WorkCenter>(`${this.baseUrl}/work-centers`, request);
  }

  updateWorkCenter(id: number, request: Partial<WorkCenter>) {
    return this.http.put<WorkCenter>(`${this.baseUrl}/work-centers/${id}`, request);
  }

  deleteWorkCenter(id: number) {
    return this.http.delete(`${this.baseUrl}/work-centers/${id}`);
  }

  // Shifts
  getShifts() {
    return this.http.get<Shift[]>(`${this.baseUrl}/shifts`);
  }

  createShift(request: CreateShiftRequest) {
    return this.http.post<Shift>(`${this.baseUrl}/shifts`, request);
  }

  updateShift(id: number, request: Partial<Shift>) {
    return this.http.put<Shift>(`${this.baseUrl}/shifts/${id}`, request);
  }

  deleteShift(id: number) {
    return this.http.delete(`${this.baseUrl}/shifts/${id}`);
  }
}
