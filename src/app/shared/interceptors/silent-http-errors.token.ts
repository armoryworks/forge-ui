import { HttpContextToken } from '@angular/common/http';

/** Set on a request whose caller handles every failure itself, so httpErrorInterceptor shows nothing. */
export const SILENT_HTTP_ERRORS = new HttpContextToken<boolean>(() => false);
