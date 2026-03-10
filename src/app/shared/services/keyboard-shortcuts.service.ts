import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  description: string;
  action: () => void;
  context?: string;
}

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly router = inject(Router);
  private readonly shortcuts = new Map<string, KeyboardShortcut>();
  private readonly _helpOpen = signal(false);
  private listener: ((e: KeyboardEvent) => void) | null = null;

  readonly helpOpen = this._helpOpen.asReadonly();

  initialize(): void {
    this.registerGlobal();

    this.listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = this.buildKey(e);
      const shortcut = this.shortcuts.get(key);
      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
    };

    document.addEventListener('keydown', this.listener);
  }

  destroy(): void {
    if (this.listener) {
      document.removeEventListener('keydown', this.listener);
      this.listener = null;
    }
  }

  register(shortcut: KeyboardShortcut): void {
    const key = this.buildKeyFromShortcut(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  unregister(key: string, modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[]): void {
    const mapKey = this.buildKeyFromShortcut({ key, modifiers });
    this.shortcuts.delete(mapKey);
  }

  getAll(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  toggleHelp(): void {
    this._helpOpen.update(v => !v);
  }

  closeHelp(): void {
    this._helpOpen.set(false);
  }

  private registerGlobal(): void {
    this.register({ key: 'g', description: 'Go to Dashboard', action: () => this.router.navigate(['/dashboard']), context: 'Navigation' });
    this.register({ key: 'k', description: 'Go to Kanban', action: () => this.router.navigate(['/kanban']), context: 'Navigation' });
    this.register({ key: 'b', description: 'Go to Backlog', action: () => this.router.navigate(['/backlog']), context: 'Navigation' });
    this.register({ key: 'p', description: 'Go to Parts', action: () => this.router.navigate(['/parts']), context: 'Navigation' });
    this.register({ key: 'i', description: 'Go to Inventory', action: () => this.router.navigate(['/inventory']), context: 'Navigation' });
    this.register({ key: 'r', description: 'Go to Reports', action: () => this.router.navigate(['/reports']), context: 'Navigation' });
    this.register({ key: 't', description: 'Go to Time Tracking', action: () => this.router.navigate(['/time-tracking']), context: 'Navigation' });

    this.register({ key: '/', description: 'Show keyboard shortcuts', action: () => this.toggleHelp(), context: 'General' });
    this.register({ key: 'Escape', description: 'Close panel/dialog', action: () => this.closeHelp(), context: 'General' });
  }

  private buildKey(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  private buildKeyFromShortcut(s: Pick<KeyboardShortcut, 'key' | 'modifiers'>): string {
    const parts: string[] = [];
    if (s.modifiers?.includes('ctrl') || s.modifiers?.includes('meta')) parts.push('ctrl');
    if (s.modifiers?.includes('alt')) parts.push('alt');
    if (s.modifiers?.includes('shift')) parts.push('shift');
    parts.push(s.key.toLowerCase());
    return parts.join('+');
  }
}
