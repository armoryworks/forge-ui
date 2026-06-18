import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { CapabilityDescriptor } from '../models/capability-descriptor.model';

interface ModuleCapMapping {
  capabilities: { code: string; area: string; name: string; isDefaultOn: boolean }[];
  foundations: string[];
  modules: Record<string, string[]>;
}

// The modules the demo can switch between. Mirrors ModuleCatalog.All on the
// server; the resolved capability sets come from the baked asset so cordoning
// stays in sync. 'inventory' is the polished one; the rest are preview.
export const DEMO_MODULES = [
  { id: 'inventory', name: 'Inventory', preview: false },
  { id: 'purchasing', name: 'Purchasing', preview: true },
  { id: 'sales', name: 'Sales and quoting', preview: true },
  { id: 'production', name: 'Production', preview: true },
  { id: 'shipping', name: 'Shipping', preview: true },
  { id: 'invoicing', name: 'Invoicing', preview: true },
  { id: 'quality', name: 'Quality', preview: true },
  { id: 'planning', name: 'Planning and scheduling', preview: true },
  { id: 'people', name: 'People', preview: true },
] as const;

const ALL_IDS = DEMO_MODULES.map(m => m.id);
const STORAGE_KEY = 'forge-demo-active-modules';

/**
 * Demo-only: holds which modules are "on" in the stubbed demo and builds the
 * capability descriptor the demo serves. Switching the active set and re-loading
 * the descriptor reconfigures the whole app (nav + *appCap) to that module set,
 * so a presenter can flip between Full suite and a cordoned single module live.
 */
@Injectable({ providedIn: 'root' })
export class DemoModuleStateService {
  private readonly http = inject(HttpClient);
  private mapping: ModuleCapMapping | null = null;

  // Default = every module (the demo "opens as today" — the full suite).
  readonly activeModules = signal<Set<string>>(this.loadPersisted());

  async ensureMapping(): Promise<ModuleCapMapping> {
    this.mapping ??= await firstValueFrom(
      this.http.get<ModuleCapMapping>('/demo-data/module-capabilities.json'));
    return this.mapping;
  }

  /** Build the capability descriptor for the current active module set. */
  async buildDescriptor(): Promise<CapabilityDescriptor> {
    const m = await this.ensureMapping();
    const active = this.activeModules();
    const enabled = new Set<string>(m.foundations);
    for (const id of active) (m.modules[id] ?? []).forEach(c => enabled.add(c));

    const capabilities = m.capabilities.map((c, i) => ({
      id: String(i + 1),
      code: c.code,
      area: c.area,
      name: c.name,
      description: '',
      enabled: enabled.has(c.code),
      isDefaultOn: c.isDefaultOn,
      requiresRoles: null,
      version: 1,
      eTag: 'W/"1"',
      configVersion: null,
      configETag: null,
      configId: null,
      dependencies: [],
      mutexes: [],
    }));

    return {
      generatedAt: new Date().toISOString(),
      totalCount: capabilities.length,
      enabledCount: capabilities.filter(c => c.enabled).length,
      capabilities,
    };
  }

  setActive(ids: string[]): void {
    const next = new Set(ids);
    this.activeModules.set(next);
    this.persist(next);
  }

  toggle(id: string): void {
    const next = new Set(this.activeModules());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.activeModules.set(next);
    this.persist(next);
  }

  selectAll(): void { this.setActive([...ALL_IDS]); }
  selectInventoryOnly(): void { this.setActive(['inventory']); }

  private loadPersisted(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* fall through to default */ }
    return new Set(ALL_IDS);
  }

  private persist(set: Set<string>): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
  }
}
