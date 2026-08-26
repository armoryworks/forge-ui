import { Injectable, inject, signal } from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AppInfoService } from './app-info.service';
import { InstanceService } from './instance.service';
import { MobileAuthService } from './mobile-auth.service';
import { PlatformService } from './platform.service';
import { SecureStorageService } from './secure-storage.service';

const DIAGNOSTICS_KEY = 'forge-diagnostics';

/**
 * Crash reports go only to the instance's own Sentry-compatible service
 * (its /.well-known publishes the DSN; none published = nothing sent) and
 * only while the device's diagnostics toggle is on. Payloads carry the
 * error, the app build and the screen — never the person or their data.
 */
@Injectable({ providedIn: 'root' })
export class CrashReportingService {
  private readonly instances = inject(InstanceService);
  private readonly mobileAuth = inject(MobileAuthService);
  private readonly secureStorage = inject(SecureStorageService);
  private readonly platform = inject(PlatformService);
  private readonly appInfo = inject(AppInfoService);

  private dsn: { endpoint: string; key: string } | null = null;

  readonly available = signal(false);
  readonly enabled = signal(true);

  async init(): Promise<void> {
    const instance = this.instances.instance();
    if (!environment.mobileShell || !instance) return;
    this.enabled.set(await this.secureStorage.getItem(this.storageKey(instance.id)) !== 'false');
    try {
      const wellKnown = await firstValueFrom(this.mobileAuth.discover(instance.serverUrl));
      this.dsn = CrashReportingService.parseDsn(wellKnown.crash_dsn);
    } catch {
      this.dsn = null;
    }
    this.available.set(this.dsn !== null);
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const instance = this.instances.instance();
    if (!instance) return;
    this.enabled.set(enabled);
    await this.secureStorage.setItem(this.storageKey(instance.id), enabled ? 'true' : 'false');
  }

  capture(error: unknown, screen: string | null): void {
    if (!this.dsn || !this.enabled()) return;
    const err = error instanceof Error ? error : new Error(String(error));
    const body = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      release: `forge-mobile@${this.appInfo.version()}`,
      environment: 'production',
      tags: { screen: screen ?? 'unknown', os: this.platform.name },
      exception: { values: [{ type: err.name, value: err.message, stacktrace: CrashReportingService.frames(err) }] },
    };
    void fetch(this.dsn.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=forge-mobile/${this.appInfo.version()}, sentry_key=${this.dsn.key}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  }

  private storageKey(instanceId: string): string {
    return `${DIAGNOSTICS_KEY}:${instanceId}`;
  }

  /** `https://<key>@<host>/<project>` → the project's store endpoint. */
  static parseDsn(dsn: string | null | undefined): { endpoint: string; key: string } | null {
    if (!dsn) return null;
    try {
      const url = new URL(dsn);
      const project = url.pathname.replace(/^\/+|\/+$/g, '');
      if (!url.username || !project) return null;
      return { endpoint: `${url.protocol}//${url.host}/api/${project}/store/`, key: url.username };
    } catch {
      return null;
    }
  }

  private static frames(err: Error): { frames: { function: string; filename: string; lineno: number | null }[] } | undefined {
    if (!err.stack) return undefined;
    const frames = err.stack.split('\n').slice(1, 30).map((line) => {
      const match = /at (.*?) \((.*?):(\d+):\d+\)/.exec(line) ?? /at (.*?):(\d+):\d+/.exec(line);
      return match
        ? { function: match.length === 4 ? match[1] : '?', filename: match.length === 4 ? match[2] : match[1], lineno: Number(match[match.length - 1]) }
        : { function: line.trim(), filename: '?', lineno: null };
    }).reverse();
    return { frames };
  }
}
