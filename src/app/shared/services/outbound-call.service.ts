import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * Phase 1r / Batch 7 — outbound-call provider abstraction. The default
 * implementation (TelLinkOutboundService) emits `tel:` URLs the
 * OS/browser dials with whatever's configured — Google Voice extension,
 * default Dialer app, FaceTime, etc. This is the vendor-neutral v1.
 *
 * Future implementations land alongside this one:
 *   • TwilioOutboundService — uses Twilio's Programmable Voice API for
 *     server-orchestrated outbound (power-dialer, voicemail-drop,
 *     recording). Lock-in to Twilio's API.
 *   • AsteriskOutboundService — self-hosted SIP via the forge-voice
 *     side repo. Asterisk handles call control; user brings their own
 *     SIP trunk (VoIP.ms, Telnyx, etc.) — commodity, swappable.
 *
 * Consumers (queue page, lead detail panel, customer detail) inject
 * IOutboundCallService and call placeCall(phone). They don't care
 * which provider's wired in.
 */
export interface OutboundCallResult {
  /** True when the dial action succeeded (link launched / API call accepted). */
  ok: boolean;
  /** Provider-specific call id when the underlying impl returns one (Twilio CallSid, Asterisk ARI id, etc.). Always null for tel-link. */
  callId: string | null;
  /** When ok=false, a short error code consumers can translate. */
  errorCode?: 'invalid-number' | 'provider-unavailable' | 'unknown';
}

export interface OutboundCallContext {
  /** Optional entity hint so providers can auto-log against the right Lead/Contact. */
  entityType?: 'Lead' | 'Contact';
  entityId?: number;
  /** Optional pre-filled wrap-up notes the provider can carry through to the auto-logged ContactInteraction. */
  notes?: string;
}

export interface IOutboundCallService {
  /** Stable id used in admin settings to identify the active provider. */
  readonly providerId: string;
  /** Human-readable name. */
  readonly providerName: string;
  /** True when this provider can actually place calls right now (credentials configured, etc.). */
  readonly isAvailable: boolean;
  /** Capability flags so the UI can show/hide power-dialer / voicemail-drop / etc. */
  readonly capabilities: {
    /** Provider can place outbound calls programmatically vs. just emit a tel: link. */
    programmaticDial: boolean;
    /** Provider records the call audio (Asterisk + Twilio = yes, tel-link = no). */
    recording: boolean;
    /** Provider supports drop-voicemail (one-click leave-pre-recorded). */
    voicemailDrop: boolean;
  };
  placeCall(phone: string, context?: OutboundCallContext): Observable<OutboundCallResult>;
}

/**
 * v1 implementation — emit a `tel:` URL and let the OS/browser handle
 * it. Works with Google Voice extension, default Dialer, FaceTime,
 * anything that registers as a tel-protocol handler. No server-side
 * telephony stack.
 *
 * Limitations: no auto-log of outbound, no voicemail-drop, no
 * power-dialer. Operator dials once per click and manually dispositions
 * the result in the queue UI.
 */
@Injectable({ providedIn: 'root' })
export class TelLinkOutboundService implements IOutboundCallService {
  readonly providerId = 'tel-link';
  readonly providerName = 'Click-to-dial (tel: link)';
  readonly isAvailable = true;
  readonly capabilities = {
    programmaticDial: false,
    recording: false,
    voicemailDrop: false,
  };

  /** Tracks the last-dialed number so the queue UI can render a "calling…" state briefly. */
  readonly lastDialedPhone = signal<string | null>(null);

  placeCall(phone: string, _context?: OutboundCallContext): Observable<OutboundCallResult> {
    // Context is ignored for tel-link (no programmatic dial = no auto-log
    // hook). Future Twilio/Asterisk impls will use the entityType/id to
    // tie the call back to the originating Lead or Contact.
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned || cleaned.length < 7) {
      return of({ ok: false, callId: null, errorCode: 'invalid-number' });
    }
    this.lastDialedPhone.set(phone);
    // Brief defer so the UI can render the call-in-progress state before
    // the tel: handler hijacks focus (some OS dialers steal it).
    setTimeout(() => {
      window.location.href = `tel:${cleaned}`;
    }, 0);
    return of({ ok: true, callId: null });
  }
}

/**
 * Phase 1r / Batch 8 — Asterisk-backed implementation. Talks to the
 * companion forge-voice side repo over HTTP. Self-hosted SIP
 * call control with the deployer's choice of SIP trunk (VoIP.ms /
 * Telnyx / Bandwidth / etc.) — vendor-neutral. Not active by default;
 * registered alongside TelLinkOutboundService so admin can flip
 * providers without a rebuild.
 *
 * The side-repo service exposes /api/voice/call which translates to
 * an ARI Originate; call-state webhooks post back to the main API
 * (CAP-EXT-VOIP-SYNC consumes them and auto-logs ContactInteraction
 * rows the same way it already does for inbound Twilio webhooks).
 */
@Injectable({ providedIn: 'root' })
export class AsteriskOutboundService implements IOutboundCallService {
  private readonly http = inject(HttpClient);

  /**
   * Base URL of the forge-voice container. Defaults to the
   * docker-compose service name; deployments override via the
   * `voiceServiceUrl` field on environment.ts (optional, undefined
   * here means the impl is not configured and isAvailable=false).
   */
  private readonly base = (environment as { voiceServiceUrl?: string }).voiceServiceUrl ?? '';

  readonly providerId = 'asterisk';
  readonly providerName = 'Asterisk (self-hosted SIP)';
  /** Availability hint based on env config — actual reachability is verified per-call. */
  readonly isAvailable = !!this.base;
  readonly capabilities = {
    programmaticDial: true,
    recording: true,
    voicemailDrop: true,
  };

  placeCall(phone: string, context?: OutboundCallContext): Observable<OutboundCallResult> {
    if (!this.isAvailable) {
      return of({ ok: false, callId: null, errorCode: 'provider-unavailable' as const });
    }
    return this.http.post<{ ok: boolean; callId: string | null; error?: string }>(
      `${this.base}/api/voice/call`,
      { phone, context },
    ).pipe(
      map(r => ({ ok: r.ok, callId: r.callId, errorCode: r.ok ? undefined : 'provider-unavailable' as const })),
      catchError(() => of({ ok: false, callId: null, errorCode: 'provider-unavailable' as const })),
    );
  }
}

/**
 * Injection token wrapper — consumers inject `OutboundCallService`
 * (the abstract symbol) and DI resolves to TelLinkOutboundService by
 * default. Switching providers later is a single line in app.config.ts.
 */
export const OutboundCallService = TelLinkOutboundService;
