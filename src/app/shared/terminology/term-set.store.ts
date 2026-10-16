import { Injectable, signal } from '@angular/core';

import type { TermSubstituter, TranslationTree } from './term-substitution';

type TermEngine = typeof import('./term-substitution');

export interface TermEntry {
  key: string;
  label: string;
}

const STORAGE_KEY = 'forge.terminology';

/**
 * Holds the install's terminology overrides and the shipped (pristine) i18n
 * catalogs, and composes the catalog a language should display: pristine
 * catalog with every catalog term replaced by its override. Shared by the
 * translate loader and {@link TerminologyService} so both compose the same
 * way; it injects nothing, which keeps the loader free of a TranslateService
 * dependency cycle. The substitution engine is a lazy chunk, fetched only
 * when the install has at least one override.
 */
@Injectable({ providedIn: 'root' })
export class TermSetStore {
  private readonly pristine = new Map<string, TranslationTree>();
  private readonly substituters = new Map<string, TermSubstituter>();
  private engine: TermEngine | null = null;
  private enginePromise: Promise<TermEngine> | null = null;
  private readonly _entries = signal<ReadonlyMap<string, string>>(readCache());

  readonly entries = this._entries.asReadonly();

  setEntries(entries: readonly TermEntry[]): boolean {
    const next = new Map(entries.filter(e => e.label?.trim()).map(e => [e.key, e.label] as const));
    if (sameEntries(this._entries(), next)) return false;
    this._entries.set(next);
    this.substituters.clear();
    writeCache(next);
    return true;
  }

  setPristine(lang: string, catalog: TranslationTree): void {
    this.pristine.set(lang, catalog);
  }

  hasPristine(lang: string): boolean {
    return this.pristine.has(lang);
  }

  loadedLanguages(): string[] {
    return [...this.pristine.keys()];
  }

  hasTerms(): boolean {
    return this._entries().size > 0;
  }

  loadEngine(): Promise<TermEngine> {
    this.enginePromise ??= import('./term-substitution').then(engine => (this.engine = engine));
    return this.enginePromise;
  }

  substituter(lang: string): TermSubstituter | null {
    if (!this.engine) return null;
    let substituter = this.substituters.get(lang);
    if (!substituter) {
      substituter = this.engine.createSubstituter(this._entries(), lang);
      this.substituters.set(lang, substituter);
    }
    return substituter;
  }

  needsGate(lang: string): boolean {
    if (lang === 'en') return false;
    const suffix = `:${lang}`;
    return [...this._entries().keys()].some(key => key.endsWith(suffix));
  }

  async compose(lang: string): Promise<TranslationTree | undefined> {
    const catalog = this.pristine.get(lang);
    if (!catalog || !this.hasTerms()) return catalog;
    const engine = await this.loadEngine();
    const substituter = this.substituter(lang) ?? engine.createSubstituter(this._entries(), lang);
    const gateCatalog = lang !== 'en' ? this.pristine.get('en') : undefined;
    return engine.transformCatalog(catalog, substituter, gateCatalog ? { catalog: gateCatalog, lang: 'en' } : undefined);
  }
}

function sameEntries(a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false;
  }
  return true;
}

function readCache(): ReadonlyMap<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return new Map(Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'));
    }
  } catch {
    return new Map();
  }
  return new Map();
}

function writeCache(entries: ReadonlyMap<string, string>): void {
  try {
    if (entries.size === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    return;
  }
}
