import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { TermSetStore } from '../terminology/term-set.store';
import { camelKey, humanizeIdentifier, snakeKey } from '../utils/display-label';

/**
 * Display text for enum values and role names the API sends as identifiers.
 * Follows the same order as {@link TerminologyService.resolve}: per-install override
 * (`status_<value>` / `role_<name>`, with a `:<lang>` suffix outside English) → the i18n
 * catalog → a humanized identifier, so no raw `InProgress` or `OfficeManager` reaches the screen.
 */
@Injectable({ providedIn: 'root' })
export class DisplayLabelService {
  private readonly store = inject(TermSetStore);
  private readonly translate = inject(TranslateService, { optional: true });

  /**
   * Label for an enum value. With a `group`, `enums.<group>.<value>` is tried before the shared
   * `status.<value>` catalog, for values whose wording depends on what they describe.
   */
  enumLabel(value: string | null | undefined, group?: string): string {
    if (value === null || value === undefined || value === '') return '';
    const raw = String(value);
    const key = camelKey(raw);
    return this.override(`status_${snakeKey(raw)}`)
      ?? (group ? this.translated(`enums.${group}.${key}`) : null)
      ?? this.translated(`status.${key}`)
      ?? humanizeIdentifier(raw);
  }

  /** Label for an identity role name such as `OfficeManager`. */
  roleLabel(name: string | null | undefined): string {
    if (name === null || name === undefined || name === '') return '';
    return this.override(`role_${snakeKey(name)}`)
      ?? this.translated(`roles.${camelKey(name)}`)
      ?? humanizeIdentifier(name);
  }

  /** Yes/No for a boolean value. */
  booleanLabel(value: boolean): string {
    const key = value ? 'common.yes' : 'common.no';
    return this.translated(key) ?? (value ? 'Yes' : 'No');
  }

  private override(key: string): string | null {
    const lang = this.translate?.getCurrentLang?.() || 'en';
    const entries = this.store.entries();
    return (lang === 'en' ? entries.get(key) : entries.get(`${key}:${lang}`)) ?? null;
  }

  private translated(key: string): string | null {
    if (!this.translate) return null;
    try {
      const text = this.translate.instant(key);
      return typeof text === 'string' && text !== key && text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }
}
