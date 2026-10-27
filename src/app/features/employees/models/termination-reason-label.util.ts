import { TranslateService } from '@ngx-translate/core';

/** The shipped reasons read in the user's language; a reason an Admin added keeps its stored label. */
export function terminationReasonLabel(translate: TranslateService, code: string, fallback: string): string {
  const key = `employees.termination.reasons.${code}`;
  const translated = translate.instant(key) as string;
  return translated && translated !== key ? translated : fallback;
}
