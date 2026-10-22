import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';

import { OperationQuantityDialogComponent } from '../../../shared/components/operation-quantity-dialog/operation-quantity-dialog.component';
import { OperationQuantityDialogData } from '../../../shared/models/operation-quantity-dialog-data.model';
import { OperationQuantityDialogResult } from '../../../shared/models/operation-quantity-dialog-result.model';
import { StepGateService } from '../../../shared/services/step-gate.service';
import { ShopFloorService } from './shop-floor.service';
import { JobOperationRow } from '../models/job-operation-row.model';
import { JobOperationProgressResult } from '../models/job-operation-progress-result.model';
import { JobOperationTimerStopResult } from '../models/job-operation-timer-stop-result.model';
import { KioskStepContext } from '../models/kiosk-step-context.model';
import { StopOperationTimerRequest } from '../models/stop-operation-timer-request.model';

@Injectable({ providedIn: 'root' })
export class KioskStepActionsService {
  private readonly shopFloor = inject(ShopFloorService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly stepGate = inject(StepGateService);

  loadStep(jobId: number, operationId: number): Observable<{ row: JobOperationRow; context: KioskStepContext } | null> {
    return forkJoin([this.shopFloor.getOperations(jobId), this.shopFloor.getConfig()]).pipe(
      map(([ops, config]) => {
        const row = ops.operations.find(op => op.operationId === operationId);
        return row ? {
          row,
          context: {
            jobQuantity: ops.jobQuantity,
            decimalPlaces: ops.quantityDecimalPlaces ?? null,
            reasons: config.reasons ?? [],
            gating: ops.stepGating ?? null,
          },
        } : null;
      }),
    );
  }

  stop(jobId: number, row: JobOperationRow, context: KioskStepContext, entryType: string | null): Observable<JobOperationTimerStopResult | null> {
    if (row.operationId == null) return of(null);
    const operationId = row.operationId;
    if (entryType !== 'Run') return this.shopFloor.stopOperationTimer(jobId, operationId);

    return this.openDialog(row, context, 'stop').pipe(
      switchMap(result => result ? this.shopFloor.stopOperationTimer(jobId, operationId, toStopRequest(result)) : of(null)),
    );
  }

  recordPieces(
    jobId: number, row: JobOperationRow, context: KioskStepContext, initialQuantity: number | null = null,
  ): Observable<JobOperationProgressResult | null> {
    if (row.operationId == null) return of(null);
    const operationId = row.operationId;
    return this.openDialog(row, context, 'record', initialQuantity).pipe(
      switchMap(result => result
        ? this.shopFloor.updateOperationProgress(jobId, operationId, {
          completedQuantity: result.completedQuantity,
          scrapQuantity: result.scrapQuantity,
          status: result.complete ? 'Complete' : null,
          expectedVersion: row.version,
          ...(result.reworkQuantity > 0 ? { reworkQuantity: result.reworkQuantity } : {}),
          ...(result.reasonCode ? { reasonCode: result.reasonCode } : {}),
          ...gateAcknowledgement(result),
        })
        : of(null)),
    );
  }

  private openDialog(
    row: JobOperationRow, context: KioskStepContext, mode: 'stop' | 'record', initialQuantity: number | null = null,
  ): Observable<OperationQuantityDialogResult | undefined> {
    return this.dialog.open<OperationQuantityDialogComponent, OperationQuantityDialogData, OperationQuantityDialogResult | undefined>(
      OperationQuantityDialogComponent, {
        width: '560px',
        maxWidth: '95vw',
        data: {
          title: this.translate.instant('shopFloor.operations.quantityTitle', { step: row.stepNumber, title: row.title }),
          jobQuantity: context.jobQuantity,
          completedQuantity: row.completedQuantity,
          scrapQuantity: row.scrapQuantity,
          reasons: context.reasons,
          touch: true,
          decimalPlaces: context.decimalPlaces,
          mode,
          plannedQuantity: row.plannedQuantity ?? null,
          gate: this.stepGate.gateFor(row, context.gating),
          initialQuantity,
        },
      }).afterClosed();
  }
}

function toStopRequest(result: OperationQuantityDialogResult): StopOperationTimerRequest {
  if (result.skipped) return {};
  return {
    ...(result.addedQuantity > 0 ? { goodQuantity: result.addedQuantity } : {}),
    ...(result.addedScrap > 0 ? { scrapQuantity: result.addedScrap } : {}),
    ...(result.complete ? { markComplete: true } : {}),
    ...(result.reasonCode ? { reasonCode: result.reasonCode } : {}),
    ...gateAcknowledgement(result),
  };
}

function gateAcknowledgement(result: OperationQuantityDialogResult): { acknowledgeGate?: boolean; overrideReason?: string | null } {
  return result.acknowledgeGate ? { acknowledgeGate: true, overrideReason: result.overrideReason ?? null } : {};
}
