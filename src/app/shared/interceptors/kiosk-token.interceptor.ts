import { HttpInterceptorFn } from '@angular/common/http';

const KIOSK_HEADER = 'X-Kiosk-Device-Token';
const KIOSK_TOKEN_KEY = 'forge-kiosk-device-token';

// Endpoints the kiosk may call outside of /display/shop-floor that accept the
// device token as a fallback credential (via [KioskTerminalAuth] on the server).
const KIOSK_ALLOWLIST_PATTERNS = [/\/api\/v\d+\/reference-data(\/|$|\?)/];

export const kioskTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(KIOSK_TOKEN_KEY);
  if (!token) {
    return next(req);
  }

  const isKioskRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/display/shop-floor');
  const isShopFloorApi = req.url.includes('/display/shop-floor');
  const isKioskAllowlist = isKioskRoute && KIOSK_ALLOWLIST_PATTERNS.some(re => re.test(req.url));

  if (!isShopFloorApi && !isKioskAllowlist) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [KIOSK_HEADER]: token } }));
};
