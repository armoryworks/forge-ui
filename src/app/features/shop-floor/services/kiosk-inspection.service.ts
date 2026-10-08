import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { AuthService } from '../../../shared/services/auth.service';
import { JobDetail } from '../../kanban/models/job-detail.model';
import { KanbanJob } from '../../kanban/models/kanban-job.model';
import { LotRecord } from '../../quality/models/lot-record.model';
import { NonConformance } from '../../quality/models/non-conformance.model';
import { QcInspection } from '../../quality/models/qc-inspection.model';
import { QcTemplate } from '../../quality/models/qc-template.model';
import { NcrCapaService } from '../../quality/services/ncr-capa.service';
import { QualityService } from '../../quality/services/quality.service';
import { CreateKioskInspectionRequest } from '../models/create-kiosk-inspection-request.model';
import { KioskInspectionLookup } from '../models/kiosk-inspection-lookup.model';
import { KioskInspectionTarget } from '../models/kiosk-inspection-target.model';
import { ScanIdentification } from '../models/scan-identification.model';
import { ShopFloorService } from './shop-floor.service';

const JOB_SEARCH_PAGE_SIZE = 200;

@Injectable({ providedIn: 'root' })
export class KioskInspectionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly quality = inject(QualityService);
  private readonly ncrCapa = inject(NcrCapaService);
  private readonly shopFloor = inject(ShopFloorService);
  private readonly inspectionsUrl = `${environment.apiUrl}/quality/inspections`;
  private readonly jobsUrl = `${environment.apiUrl}/jobs`;

  findTarget(partId: number, scanned: string): Observable<KioskInspectionLookup> {
    const value = scanned.trim();
    return this.findLot(value).pipe(
      switchMap(lot => {
        if (!lot) return this.findJob(partId, value);
        if (lot.partId !== partId) return of<KioskInspectionLookup>({ status: 'otherPart', partNumber: lot.partNumber });
        return of<KioskInspectionLookup>({
          status: 'found',
          target: { jobId: lot.jobId, jobNumber: lot.jobNumber, lotNumber: lot.lotNumber, lotQuantity: lot.quantity },
        });
      }),
    );
  }

  findTemplates(partId: number): Observable<QcTemplate[]> {
    return this.quality.getTemplates().pipe(
      map(templates => templates
        .filter(t => t.isActive && t.partId === partId)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)),
    );
  }

  openInspection(partId: number, templateId: number | null, target: KioskInspectionTarget): Observable<QcInspection> {
    return this.findOpenInspection(partId, templateId, target).pipe(
      switchMap(open => open ? of(open) : this.createInspection({
        partId,
        jobId: target.jobId ?? undefined,
        templateId: templateId ?? undefined,
        lotNumber: target.lotNumber ?? undefined,
      })),
    );
  }

  completeInspection(
    id: number,
    data: Parameters<QualityService['updateInspection']>[1],
  ): Observable<QcInspection> {
    return this.quality.updateInspection(id, data);
  }

  raiseNcr(inspection: QcInspection, partId: number, description: string, affectedQuantity: number): Observable<NonConformance> {
    return this.ncrCapa.createNcr({
      type: 'Internal',
      partId,
      jobId: inspection.jobId,
      lotNumber: inspection.lotNumber,
      qcInspectionId: inspection.id,
      detectedAtStage: 'InProcess',
      description,
      affectedQuantity,
    });
  }

  private findLot(value: string): Observable<LotRecord | null> {
    const upper = value.toUpperCase();
    return this.searchLots(value).pipe(
      switchMap(lot => lot || upper === value ? of(lot) : this.searchLots(upper)),
    );
  }

  private searchLots(value: string): Observable<LotRecord | null> {
    return this.quality.getLotRecords({ search: value }).pipe(
      catchError(() => of<LotRecord[]>([])),
      map(lots => lots.find(l => sameNumber(l.lotNumber, value)) ?? null),
    );
  }

  private findJob(partId: number, value: string): Observable<KioskInspectionLookup> {
    return this.identifyJobId(value).pipe(
      switchMap(jobId => jobId !== null ? of(jobId) : this.searchJobId(value, false)),
      switchMap(jobId => jobId !== null ? of(jobId) : this.searchJobId(value, true)),
      switchMap(jobId => jobId === null
        ? of<KioskInspectionLookup>({ status: 'notFound' })
        : this.http.get<JobDetail>(`${this.jobsUrl}/${jobId}`).pipe(switchMap(detail => this.jobLookup(partId, detail)))),
    );
  }

  private identifyJobId(value: string): Observable<number | null> {
    return this.shopFloor.identifyScan(value).pipe(
      catchError(() => of<ScanIdentification | null>(null)),
      map(identified => identified?.scanType === 'job' && identified.entityId ? identified.entityId : null),
    );
  }

  private searchJobId(jobNumber: string, archived: boolean): Observable<number | null> {
    const params: Record<string, string | number | boolean> = { q: jobNumber, pageSize: JOB_SEARCH_PAGE_SIZE };
    if (archived) params['isArchived'] = true;
    return this.http.get<PagedResponse<KanbanJob>>(this.jobsUrl, { params }).pipe(
      map(page => page.items.find(j => sameNumber(j.jobNumber, jobNumber))?.id ?? null),
    );
  }

  private jobLookup(partId: number, detail: JobDetail): Observable<KioskInspectionLookup> {
    if (detail.partId !== null && detail.partId !== partId)
      return of<KioskInspectionLookup>({ status: 'otherPart', partNumber: detail.partNumber });
    return this.quality.getLotRecords({ partId, jobId: detail.id }).pipe(
      catchError(() => of<LotRecord[]>([])),
      map((lots): KioskInspectionLookup => {
        const onlyLot = lots.length === 1 ? lots[0] : null;
        return {
          status: 'found',
          target: {
            jobId: detail.id,
            jobNumber: detail.jobNumber,
            lotNumber: onlyLot?.lotNumber ?? null,
            lotQuantity: onlyLot?.quantity ?? null,
          },
        };
      }),
    );
  }

  private findOpenInspection(
    partId: number,
    templateId: number | null,
    target: KioskInspectionTarget,
  ): Observable<QcInspection | null> {
    const inspectorId = this.auth.user()?.id ?? null;
    if (inspectorId === null) return of(null);
    const linked = target.jobId !== null || target.lotNumber !== null;
    return this.quality.getInspections({
      status: 'InProgress',
      jobId: target.jobId ?? undefined,
      lotNumber: target.lotNumber ?? undefined,
    }).pipe(
      map(inspections => inspections.find(i =>
        i.status === 'InProgress'
        && i.inspectorId === inspectorId
        && i.jobId === target.jobId
        && i.lotNumber === target.lotNumber
        && i.templateId === templateId
        && (linked ? (i.partId ?? partId) === partId : i.partId === partId)) ?? null),
    );
  }

  private createInspection(request: CreateKioskInspectionRequest): Observable<QcInspection> {
    return this.http.post<QcInspection>(this.inspectionsUrl, request);
  }
}

function sameNumber(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
