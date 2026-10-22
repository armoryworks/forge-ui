import { TranslateService } from '@ngx-translate/core';

/** The server's label for the not-yet-due aging bucket. */
export const CURRENT_BUCKET_LABEL = 'Current';

/** Display label for an aging bucket: the not-yet-due bucket is translated, day ranges show as sent. */
export function agingBucketLabel(label: string, translate: TranslateService): string {
  return label === CURRENT_BUCKET_LABEL ? translate.instant('accounting.aging.current') : label;
}
