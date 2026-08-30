# forge-ui

The Angular single-page application for **[Forge](https://github.com/armoryworks/forge)** — free, open-source ERP and MES for job shops: job cards on the floor, books in the office, one database.

This repo is the frontend only. It is a browser SPA (also packaged as a native mobile shell) that talks to the Forge API over HTTP and SignalR. It holds no data of its own.

| Repo | What it is |
|------|-----------|
| **[forge](https://github.com/armoryworks/forge)** | Umbrella repo — docs, governance, release manifest. Start here. |
| **forge-ui** (this repo) | Angular frontend, served by nginx in production |
| **[forge-api](https://github.com/armoryworks/forge-api)** | .NET API over PostgreSQL |
| **[forge-deploy](https://github.com/armoryworks/forge-deploy)** | Docker Compose stack + the `forge-deploy` CLI — start here to install |

Built by **[Armory Works](https://armoryworks.com)**.

---

## Stack

- **Angular 21.2** — standalone components throughout (no `NgModule`s), `OnPush` change detection, signal-based state (`signal`, `computed`, `input`, `output`), and zoneless change detection (no `zone.js` polyfill is configured in `angular.json`).
- **Angular Material 21 + CDK** for components, overlays, and dialogs.
- **SCSS** with a design-token layer in `src/styles/` — light and dark themes switch on a `data-theme` attribute on `<html>`. Fonts and Material icons are self-hosted via `@fontsource` rather than pulled from a CDN, so the app renders correctly offline and on air-gapped networks.
- **TypeScript 5.9**, **RxJS 7.8**.
- **`@ngx-translate/core`** for i18n, **`@microsoft/signalr`** for realtime updates, **`@angular/service-worker`** for offline shell caching in production builds.
- **Capacitor 7** for the iOS/Android native shell.
- **Vitest** for unit tests, **Playwright** for end-to-end, **Cypress + axe** for the accessibility suite.

---

## Prerequisites

- **Node.js 24** with npm — the version CI and the container images both build on.
- **A running Forge API.** The SPA has no backend of its own — see the next section.
- For the native shell only: Android Studio (Android) and/or Xcode (iOS).

---

## Quickstart

```bash
git clone https://github.com/armoryworks/forge-ui.git
cd forge-ui
npm install
npm start                 # dev server on http://localhost:4200
```

### Pointing the dev server at an API

In development the app calls the API at the absolute URL in `src/environments/environment.ts`:

```ts
apiUrl: 'http://localhost:5000/api/v1',
hubUrl: 'http://localhost:5000/hubs',
```

So the simplest local setup is the API running on port 5000 — from a [forge-api](https://github.com/armoryworks/forge-api) checkout:

```bash
dotnet run --project forge.api      # serves http://localhost:5000
```

`http://localhost:4200` is in the API's default CORS allow-list, so no extra configuration is needed. If your API lives elsewhere, edit `apiUrl`/`hubUrl` in `src/environments/environment.ts` (it is a development-only file and is replaced at build time for every other configuration).

Alternatively, bring the whole stack up with Docker from a [forge-deploy](https://github.com/armoryworks/forge-deploy) checkout and run the UI against it.

`proxy.conf.json` is wired into `ng serve` and forwards `/api`, `/hubs`, and `/docuseal` to the Compose service names (`forge-api:8080`, `forge-signing:3000`). That path is for the containerized dev server (`Dockerfile.dev`), where those hostnames resolve; on a host dev box the absolute `environment.ts` URLs are what the app actually uses.

---

## Scripts and gates

Every command below is defined in `package.json`.

| Command | What it does |
|---------|--------------|
| `npm start` | Dev server with live reload on `http://localhost:4200` |
| `npm run build` | Production build → `dist/forge-ui/browser` |
| `npm run watch` | Development build in watch mode |
| `npm test` | Vitest unit tests (`src/**/*.spec.ts`, jsdom). Add `-- --watch=false` for a single run |
| `npm run lint` | ESLint + `@angular-eslint` over `src/**/*.ts` and `src/**/*.html` |
| `npm run lint:i18n` | Translation-catalog check (see below) |
| `npm run lint:standards` | Project coding-standard checks that ESLint can't express |
| `npm run lint:a11y` | ESLint template-accessibility rules over `src/**/*.html` |
| `npm run e2e` | Playwright end-to-end suite (`e2e/tests`) |
| `npm run e2e:headed` | Same, with a visible browser |
| `npm run test:a11y` | Cypress + axe accessibility spec |
| `npm run build:mobile` | Native-shell build → `dist/forge-ui-mobile` |
| `npm run cap:sync` | `build:mobile`, then `npx cap sync` into `android/` and `ios/` |

**The pull-request gate** (`.github/workflows/ci.yml`) runs, in order: `lint`, `lint:i18n`, `lint:standards`, `build`, and `test -- --watch=false`. Run the same five locally before pushing.

What the two custom checks do:

- **`lint:i18n`** (`scripts/lint-i18n.mjs`) scans templates and TypeScript for statically extractable translation keys — `'x.y' | translate`, `[translate]="'x.y'"`, `translate.instant('x.y')`, and similar — and fails if a referenced key is missing from `en.json`. It also enforces 1:1 parity between `en.json` and `es.json` in both directions: a key in one and not the other is a failure. Keys supplied dynamically or by server data are listed in `scripts/.lint-i18n-allow`. This exists because a missing key is silent in `tsc`, `ng build`, and unit tests, and only shows up in the running UI as a raw `foo.bar` token.
- **`lint:standards`** (`scripts/lint-standards.mjs`) enforces conventions ESLint can't see — no `console.log` in shipped code, no hardcoded hex colors in SCSS (use the design tokens), no unexplained `!important`, no inline component templates, no raw `<input>` / `<select>` / `<textarea>` in feature templates (use the shared form wrappers), reactive forms only. Rules with legacy debt are ratcheted per file in `scripts/standards-baseline.json`: a file not in the baseline must be clean, and a baselined file may never get worse.

### End-to-end tests

Playwright does not start anything for you. Have the dev server running on `http://localhost:4200` and the API on `http://localhost:5000`, then run `npm run e2e`. Override with `E2E_BASE_URL`, `E2E_API_URL`, and `SEED_USER_PASSWORD` if your environment differs. The suite is slow and runs nightly in CI rather than on every pull request.

---

## Internationalization

All user-facing strings go through `@ngx-translate`. The catalogs are static assets:

```
public/assets/i18n/en.json      # canonical source
public/assets/i18n/es.json      # must match en.json key-for-key
```

They are loaded over HTTP at runtime from `/assets/i18n/`, the default language is `en`, and the user's choice is persisted in `localStorage` under `language`.

**English and Spanish must stay in sync.** Add a key to `en.json` and add its Spanish counterpart in the same change; remove one and remove both. `npm run lint:i18n` fails on any drift in either direction, so this is enforced, not aspirational. A new language file joins under the same contract: every `en.json` key must exist in it before it merges.

Note that `public/assets/i18n/` is the only bundled catalog path — `src/assets/i18n/` is deliberately absent and must not be recreated.

---

## Mobile / native shell

The native app is Capacitor 7 wrapping the same codebase, with `android/` and `ios/` projects committed to this repo.

```bash
npm run cap:sync            # build:mobile + npx cap sync
npx cap open android        # or: npx cap open ios
```

`npm run build:mobile` compiles the `mobile` configuration (which swaps in `src/environments/environment.mobile.ts`) to `dist/forge-ui-mobile`, the `webDir` in `capacitor.config.ts`. App id is `com.armoryworks.forge`.

There is no `server.url` in the Capacitor config: web assets ship inside the binary. The API host is per-instance and resolved at runtime — the mobile build issues relative `/api/v1/...` requests and an HTTP interceptor prefixes the enrolled instance's origin. Nothing in the native build names a host.

---

## Build configurations

`npm run build` defaults to `production`. The other configurations are invoked through the Angular CLI:

| Configuration | Command | Output | Environment file |
|---------------|---------|--------|------------------|
| `production` (default) | `npm run build` | `dist/forge-ui/browser` | `environment.prod.ts` |
| `development` | `npm run watch` | `dist/forge-ui/browser` | `environment.ts` |
| `mobile` | `npm run build:mobile` | `dist/forge-ui-mobile` | `environment.mobile.ts` |
| `demo` | `npx ng build --configuration=demo` | `dist/forge-ui-demo` | `environment.demo.ts` |

The production configuration also enables the service worker (`ngsw-config.json`) and enforces bundle budgets. The demo configuration builds a fully static, mocked-data variant with no API.

---

## Project layout

```
src/app/features/     60 feature areas — quotes, sales-orders, shop-floor,
                      inventory, purchasing, quality, training, mobile-app, …
                      Each owns its components, services, and routes.
src/app/shared/       Cross-feature building blocks: components, directives,
                      pipes, guards, HTTP interceptors, models, services,
                      validators, capability gating.
src/app/core/         Application shell and layout.
src/environments/     Per-configuration environment files.
src/styles/           SCSS design tokens, mixins, reset, shared rules.
src/testing/          Unit-test helpers.
public/               Static assets served as-is, including the i18n catalogs.
e2e/                  Playwright specs, fixtures, and helpers.
cypress/              Accessibility specs.
scripts/              lint-i18n, lint-standards, and their baselines.
android/, ios/        Capacitor native projects.
```

---

## Deploying & updating Forge

Forge is deployed and updated through **[`@armoryworks/forge-deploy`](https://github.com/armoryworks/forge-deploy)**, a self-contained npm package that bundles the entire deploy stack (compose files, `setup.sh`, and image pulls from GHCR). Install it once and run everything from the CLI — no repo checkout required.

**Install (Ubuntu):**

```bash
# Node.js 24 LTS (ships npm)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# the deploy CLI
sudo npm install -g @armoryworks/forge-deploy
```

**Deploy or update a Forge install** — point it at your install directory (e.g. `/opt/forge`):

```bash
sudo npm update -g @armoryworks/forge-deploy   # pull the latest bundled deploy config
forge-deploy /opt/forge                        # unpack + run setup; pulls newer GHCR images
```

Re-running preserves your `.env`, compose overrides, and data volumes. **Docker Engine + the Compose v2 plugin** are required on the host. Full deploy, topology (split UI/API/DB), and troubleshooting docs live in the **[forge-deploy README](https://github.com/armoryworks/forge-deploy#readme)**.

This repo also ships a production image build: `Dockerfile` compiles the production configuration and serves `dist/forge-ui/browser` from nginx using the bundled `nginx.conf`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, and the [umbrella repo's contributing guide](https://github.com/armoryworks/forge/blob/main/CONTRIBUTING.md) for the branch model and PR conventions.

**Where to file issues:**

- A bug in a UI feature → [issues in this repo](https://github.com/armoryworks/forge-ui/issues)
- API behavior → [forge-api](https://github.com/armoryworks/forge-api/issues)
- Cross-cutting design or product discussion → [forge](https://github.com/armoryworks/forge/issues)

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

Copyright 2026 Armory Works Technology, LLC.
