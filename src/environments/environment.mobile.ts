// Native-shell build (Capacitor). The API base is per-instance and resolved
// at runtime after enrollment — the empty apiUrl here is a guard: nothing may
// call the API through the static environment in the mobile build.
export const environment = {
  production: true,
  demoMode: false,
  mobileShell: true,
  apiUrl: '',
  hubUrl: '',
};
