import { Injectable, inject } from '@angular/core';

import { registerPlugin } from '@capacitor/core';

import { PlatformService } from './platform.service';

interface TlsPinPlugin {
  fingerprint(options: { host: string; port?: number }): Promise<{ sha256: string }>;
}

const TlsPin = registerPlugin<TlsPinPlugin>('TlsPin');

/** Thrown when the live certificate does not match the pinned fingerprint. */
export class TlsPinMismatchError extends Error {
  constructor(readonly host: string, readonly expected: string, readonly actual: string) {
    super(`Certificate for ${host} does not match the pinned fingerprint.`);
  }
}

/**
 * Trust-on-first-use certificate pinning. The system trust store validates
 * the chain as usual; this checks that the leaf certificate is the one the
 * instance pinned at enrollment (from the QR or /.well-known). Checked at
 * enrollment and before every session refresh — a mismatch is a hard stop,
 * never a silent bypass. Web builds skip (the browser owns TLS there).
 */
@Injectable({ providedIn: 'root' })
export class TlsPinService {
  private readonly platform = inject(PlatformService);

  /** Resolves when the pin matches (or no pin applies); throws on mismatch. */
  async assertPinned(serverUrl: string, pinnedSha256: string | null): Promise<void> {
    if (!pinnedSha256 || !this.platform.isNative) return;

    const url = new URL(serverUrl);
    const port = url.port ? Number(url.port) : 443;
    const { sha256 } = await TlsPin.fingerprint({ host: url.hostname, port });

    const expected = TlsPinService.normalize(pinnedSha256);
    const actual = TlsPinService.normalize(sha256);
    if (expected !== actual) {
      throw new TlsPinMismatchError(url.hostname, expected, actual);
    }
  }

  static normalize(fingerprint: string): string {
    return fingerprint.replace(/[^a-f0-9]/gi, '').toLowerCase();
  }
}
