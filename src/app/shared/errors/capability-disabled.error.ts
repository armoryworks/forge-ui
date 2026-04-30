/**
 * Phase 4 Phase-D — UI-side typed error raised by the global HTTP error
 * interceptor when a request is rejected because its required capability is
 * disabled for this installation.
 *
 * The server's {@code CapabilityGateMiddleware} short-circuits the call with
 * HTTP 403 + the WU-02 envelope:
 *
 * ```json
 * { "errors": [ { "code": "capability-disabled", "capability": "CAP-...", "message": "..." } ] }
 * ```
 *
 * It also sets the {@code X-Capability-Disabled} response header to the
 * capability id.
 *
 * A disabled capability is an *intentional configuration state*, not a
 * security violation, so the interceptor must not surface red error toasts /
 * snackbars / console errors. Instead, it throws this typed error so callers
 * who want to gracefully degrade (hide the AI button, render no announcement
 * card, etc.) can `catchError` for it specifically. Callers that don't catch
 * see a silent no-op — the Observable simply errors with a tagged
 * {@code CapabilityDisabledError} that the toast/snackbar layers explicitly
 * ignore.
 */
export class CapabilityDisabledError extends Error {
  override readonly name = 'CapabilityDisabledError';

  constructor(
    /** Capability code from the server envelope, e.g. {@code CAP-EXT-AI-ASSISTANT}. */
    readonly capabilityCode: string,
    message: string,
  ) {
    super(message);
    // Preserve prototype chain across transpile targets so `instanceof` works.
    Object.setPrototypeOf(this, CapabilityDisabledError.prototype);
  }
}

/** Type guard — true when the value is a {@link CapabilityDisabledError}. */
export function isCapabilityDisabledError(value: unknown): value is CapabilityDisabledError {
  return value instanceof CapabilityDisabledError
    || (typeof value === 'object' && value !== null
      && (value as { name?: string }).name === 'CapabilityDisabledError');
}
