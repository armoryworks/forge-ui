import { HttpInterceptorFn } from '@angular/common/http';

const KIOSK_HEADER = 'X-Kiosk-Device-Token';
const KIOSK_TOKEN_KEY = 'qbe-kiosk-device-token';

export const kioskTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/display/shop-floor')) {
    return next(req);
  }
  const token = localStorage.getItem(KIOSK_TOKEN_KEY);
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { [KIOSK_HEADER]: token } }));
};
