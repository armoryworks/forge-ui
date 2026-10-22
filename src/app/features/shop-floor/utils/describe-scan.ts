import { TranslateService } from '@ngx-translate/core';

import { ScanIdentification } from '../models/scan-identification.model';

export function describeNonClockScan(result: ScanIdentification, translate: TranslateService): string | null {
  const number = result.entityNumber;
  switch (result.scanType) {
    case 'asset':
      return number
        ? translate.instant('shopFloor.display.assetScanned', { name: number })
        : translate.instant('shopFloor.display.assetScannedUnnamed');
    case 'part':
      return number ? translate.instant('shopFloor.display.partScanned', { number }) : null;
    case 'lot':
      return number ? translate.instant('shopFloor.display.lotScanned', { number }) : null;
    case 'purchase-order':
      return number ? translate.instant('shopFloor.display.purchaseOrderScanned', { number }) : null;
    case 'sales-order':
      return number ? translate.instant('shopFloor.display.salesOrderNumber', { number }) : null;
    case 'storage-location': {
      const name = result.entityTitle ?? number;
      return name ? translate.instant('shopFloor.display.locationScanned', { name }) : null;
    }
    default:
      return null;
  }
}
