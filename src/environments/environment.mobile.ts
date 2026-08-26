// Native-shell build (Capacitor). The API base is per-instance and resolved
// at runtime: services compose relative '/api/v1/…' URLs and the
// apiBaseInterceptor (registered last) prefixes the enrolled instance's
// origin and device headers. Nothing here may name a host.
export const environment = {
  production: true,
  demoMode: false,
  mobileShell: true,
  apiUrl: '/api/v1',
  hubUrl: '/hubs',
};
