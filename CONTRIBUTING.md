# Contributing to forge-ui

For project-wide guidelines (branch model, PR conventions, code style),
see the umbrella repo:
**https://github.com/armoryworks/forge/blob/main/CONTRIBUTING.md**

## Repo-specific setup

```bash
git clone https://github.com/armoryworks/forge-ui.git
cd forge-ui
npm install
```

You'll also need the API running. Easiest is via the deploy repo:

```bash
# In a separate clone:
git clone https://github.com/armoryworks/forge-deploy.git
cd forge-deploy
docker compose up -d forge-api forge forge-storage
```

Then start the UI dev server:

```bash
npm start                   # serves at http://localhost:4200
```

## Tests

```bash
npm run lint                # ESLint + @angular-eslint
npm run build               # production build (must pass for PR)
npm run test                # Vitest unit tests
npm run e2e                 # Playwright (slow; nightly in CI, not gated on PR)
```

## Per-repo conventions

See [`docs/coding-standards.md` in the umbrella repo](https://github.com/armoryworks/forge/blob/main/docs/coding-standards.md)
for Angular-specific patterns: shared form wrappers, dialog component,
SCSS variables, button taxonomy, etc.

## Where to file what

- **Bug in a UI feature** → file an issue here
- **API behavior bug** → file in forge-api
- **Cross-cutting design discussion** → file in forge (umbrella)
