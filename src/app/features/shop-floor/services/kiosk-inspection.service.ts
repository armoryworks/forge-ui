import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { JobDetail } from '../../kanban/models/job-detail.model';
import { KanbanJob } from '../../kanban/models/kanban-job.model';
import { LotRecord } from '../../quality/models/lot-record.model';
import { NonConformance } from '../../quality/models/non-conformance.model';
import { QcInspection } from '../../quality/models/qc-inspection.model';
import { NcrCapaService } from '../../quality/services/ncr-capa.service';
import { QualityService } from '../../quality/services/quality.service';
import { CreateKioskInspectionRequest } from '../models/create-kiosk-inspection-request.model';
import { KioskInspectionLookup } from '../models/kiosk-inspection-lookup.model';
import { KioskInspectionTarget } from '../models/kiosk-inspection-target.model';

@Injectable({ providedIn: 'root' })
export class KioskInspectionService {
  private readonly http = inject(HttpClient);
  private readonly quality = inject(QualityService);
  private readonly ncrCapa = inject(NcrCapaService);
  private readonly inspectionsUrl = `${environment.apiUrl}/quality/inspections`;
  private readonly jobsUrl = `${environment.apiUrl}/jobs`;

  findTarget(partId: number, scanned: string): Observable<KioskInspectionLookup> {
    const value = scanned.trim();
    return this.quality.getLotRecords({ search: value }).pipe(
      catchError(() => of<LotRecord[]>([])),
      switchMap(lots => {
        const lot = lots.find(l => sameNumber(l.lotNumber, value));
        if (!lot) return this.findJob(partId, value);
        if (lot.partId !== partId) return of<KioskInspectionLookup>({ status: 'otherPart', partNumber: lot.partNumber });
        return of<KioskInspectionLookup>({
          status: 'found',
          target: { jobId: lot.jobId, jobNumber: lot.jobNumber, lotNumber: lot.lotNumber, lotQuantity: lot.quantity },
        });
      }),
    );
  }

  openInspection(partId: number, templateId: number | null, target: KioskInspectionTarget): Observable<QcInspection> {
    const templateId$ = templateId ? of(templateId) : this.findTemplateId(partId);
    return templateId$.pipe(
      switchMap(resolvedTemplateId => this.findOpenInspection(partId, resolvedTemplateId, target).pipe(
        switchMap(open => open ? of(open) : this.createInspection({
          partId,
          jobId: target.jobId ?? undefined,
          templateId: resolvedTemplateId ?? undefined,
          lotNumber: target.lotNumber ?? undefined,
        })),
      )),
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

  private findJob(partId: number, jobNumber: string): Observable<KioskInspectionLookup> {
    return this.http.get<PagedResponse<KanbanJob>>(this.jobsUrl, { params: { q: jobNumber, pageSize: 25 } }).pipe(
      map(page => page.items.find(j => sameNumber(j.jobNumber, jobNumber)) ?? null),
      switchMap(job => {
        if (!job) return of<KioskInspectionLookup>({ status: 'notFound' });
        return this.http.get<JobDetail>(`${this.jobsUrl}/${job.id}`).pipe(
          switchMap(detail => {
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
          }),
        );
      }),
    );
  }

  private findTemplateId(partId: number): Observable<number | null> {
    return this.quality.getTemplates().pipe(
      map(templates => templates
        .filter(t => t.isActive && t.partId === partId)
        .sort((a, b) => a.id - b.id)[0]?.id ?? null),
    );
  }

  private findOpenInspection(
    partId: number,
    templateId: number | null,
    target: KioskInspectionTarget,
  ): Observable<QcInspection | null> {
    if (target.jobId === null && target.lotNumber === null) return of(null);
    return this.quality.getInspections({
      status: 'InProgress',
      jobId: target.jobId ?? undefined,
      lotNumber: target.lotNumber ?? undefined,
    }).pipe(
      map(inspections => inspections.find(i =>
        i.status === 'InProgress'
        && i.jobId === target.jobId
        && i.lotNumber === target.lotNumber
        && i.templateId === templateId
        && (i.partId ?? partId) === partId) ?? null),
    );
  }

  private createInspection(request: CreateKioskInspectionRequest): Observable<QcInspection> {
    return this.http.post<QcInspection>(this.inspectionsUrl, request);
  }
}

function sameNumber(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
