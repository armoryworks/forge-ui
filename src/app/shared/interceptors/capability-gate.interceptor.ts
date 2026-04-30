import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

import { resolveCapabilityForUrl } from '../capability/capability-endpoint-registry';
import { CapabilityDisabledError } from '../errors/capability-disabled.error';
import { CapabilityService } from '../services/capability.service';

/**
 * Phase 4 Phase-D (layer-3) — capability-gate request interceptor.
 *
 * Pre-flights every outbound HTTP request against the URL → capability
 * registry. If the request hits a gated endpoint AND the capability is
 * known to be disabled in the current descriptor snapshot, the request is
 * short-circuited with a {@link CapabilityDisabledError} — the network
 * request never fires.
 *
 * This is the layer-3 complement to the layer-2 work in
 * `httpErrorInterceptor`:
 *  - **Layer 2** (existing): catches a 403 + WU-02 envelope from the server
 *    and rethrows as `CapabilityDisabledError`. Suppresses the
 *    access-denied snackbar / red console error.
 *  - **Layer 3** (this file): never lets the request leave the browser when
 *    the descriptor already says the capability is off. Devtools network
 *    tab stays clean; console stays clean.
 *
 * Two-layer defence is intentional:
 *  - The descriptor may not be loaded yet at app boot (race window).
 *  - An admin can flip a capability off mid-session — the next call should
 *    not fire even if the cached snapshot is briefly stale.
 *  - The registry covers controller-level gates only; method-level gates
 *    (`InventoryController` action-level overrides, etc.) are still caught
 *    by layer 2.
 *
 * Behaviour:
 *  - If the URL does not match any gated endpoint → request passes through
 *    untouched. (No false positives — the registry is a closed allow-list
 *    of gated paths, not a deny-list.)
 *  - If the URL matches a gated endpoint AND the capability is unknown
 *    (descriptor not yet loaded, or capability not in the snapshot) → the
 *    request is allowed through. The server will gate it if appropriate
 *    and the layer-2 interceptor will translate any 403.
 *  - If the URL matches a gated endpoint AND the capability is known and
 *    `enabled === false` → the request is short-circuited with a
 *    `CapabilityDisabledError`. A `console.debug` line records the block
 *    for diagnostics without flagging in devtools as an error.
 *
 * The interceptor MUST be registered before `httpErrorInterceptor` in the
 * `withInterceptors([...])` chain so a short-circuited error doesn't
 * traverse the error pipeline.
 */
export const capabilityGateInterceptor: HttpInterceptorFn = (req, next) => {
  const capabilityService = inject(CapabilityService);

  const code = resolveCapabilityForUrl(req.url);
  if (code === null) {
    // Not a gated endpoint — pass through.
    return next(req);
  }

  // Only block when we KNOW the capability is disabled. Unknown / not-yet-
  // loaded descriptor falls through to the server; layer 2 catches a 403.
  if (capabilityService.isKnown(code) && !capabilityService.isEnabled(code)) {
    // Diagnostic visibility without flagging as an error in devtools.
    console.debug(`[capability-gate] short-circuit ${req.method} ${req.url} (${code} disabled)`);
    return throwError(
      () => new CapabilityDisabledError(
        code,
        'This capability is disabled for this installation.',
      ),
    );
  }

  return next(req);
};
