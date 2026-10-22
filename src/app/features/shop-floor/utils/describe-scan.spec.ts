import { TranslateService } from '@ngx-translate/core';

import { describeNonClockScan } from './describe-scan';

describe('describeNonClockScan', () => {
  const translate = {
    instant: (key: string, params?: Record<string, string>) => `${key}${params ? ' ' + JSON.stringify(params) : ''}`,
  } as unknown as TranslateService;

  it('names a part by its number', () => {
    expect(describeNonClockScan({ scanType: 'part', entityNumber: 'BRK-100' }, translate))
      .toBe('shopFloor.display.partScanned {"number":"BRK-100"}');
  });

  it('names a location by its path', () => {
    expect(describeNonClockScan({ scanType: 'storage-location', entityTitle: 'Warehouse / A1' }, translate))
      .toBe('shopFloor.display.locationScanned {"name":"Warehouse / A1"}');
  });

  it('describes an unnamed asset label', () => {
    expect(describeNonClockScan({ scanType: 'asset' }, translate)).toBe('shopFloor.display.assetScannedUnnamed');
  });

  it('returns null for an unknown scan or a document with no number', () => {
    expect(describeNonClockScan({ scanType: 'unknown' }, translate)).toBeNull();
    expect(describeNonClockScan({ scanType: 'lot' }, translate)).toBeNull();
  });
});
