// Demo build — replaces environment.ts via angular.json fileReplacements when
// building `ng build --configuration=demo`. Deployed to demo.forge.com
// and fully static: no real API, no SignalR, all data mocked in-browser.
//
// apiUrl / hubUrl are intentionally empty strings so that any accidental
// attempt to make a real network call fails loudly instead of silently
// hitting production. The mock HTTP service intercepts before HttpClient
// would dispatch.
export const environment = {
  production: true,
  demoMode: true,
  apiUrl: '',
  hubUrl: '',
};
