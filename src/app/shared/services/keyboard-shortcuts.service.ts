import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  /** If set, this shortcut requires the chord prefix key to be pressed first (e.g. 'g') */
  chord?: string;
  description: string;
  action: () => void;
  context?: string;
}

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly router = inject(Router);
  private readonly shortcuts = new Map<string, KeyboardShortcut>();
  private readonly _helpOpen = signal(false);
  private readonly _chordActive = signal(false);
  private listener: ((e: KeyboardEvent) => void) | null = null;
  private chordTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly helpOpen = this._helpOpen.asReadonly();
  /** True while waiting for the second key of a chord sequence (e.g. after pressing 'g') */
  readonly chordActive = this._chordActive.asReadonly();

  initialize(): void {
    this.registerGlobal();

    this.listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (inInput) {
        // Cancel any pending chord if user focuses an input mid-sequence
        this.cancelChord();
        return;
      }

      // Ignore events with modifier keys for chord prefix detection
      if (e.ctrlKey || e.altKey || e.metaKey) {
        const key = this.buildKey(e);
        const shortcut = this.shortcuts.get(key);
        if (shortcut && !shortcut.chord) {
          e.preventDefault();
          shortcut.action();
        }
        return;
      }

      const pressedKey = e.key.toLowerCase();

      // ── Chord second key ──────────────────────────────────────────
      if (this._chordActive()) {
        this.cancelChord();
        // Look for a chord shortcut matching the pressed key under chord prefix 'q'
        const chordKey = `q+${pressedKey}`;
        const shortcut = this.shortcuts.get(chordKey);
        if (shortcut) {
          e.preventDefault();
          shortcut.action();
        }
        return;
      }

      // ── Chord first key (q) ───────────────────────────────────────
      if (pressedKey === 'q' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Only activate chord if there's at least one q-prefixed shortcut registered
        const hasChordShortcuts = Array.from(this.shortcuts.keys()).some(k => k.startsWith('q+'));
        if (hasChordShortcuts) {
          e.preventDefault();
          this._chordActive.set(true);
          this.chordTimeout = setTimeout(() => this.cancelChord(), 1500);
          return;
        }
      }

      // ── Plain shortcuts (no chord, no modifier) ───────────────────
      const shortcut = this.shortcuts.get(pressedKey);
      if (shortcut && !shortcut.chord) {
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
    this.cancelChord();
  }

  register(shortcut: KeyboardShortcut): void {
    const key = this.buildKeyFromShortcut(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  unregister(key: string, modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[], chord?: string): void {
    const mapKey = this.buildKeyFromShortcut({ key, modifiers, chord });
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

  private cancelChord(): void {
    this._chordActive.set(false);
    if (this.chordTimeout) {
      clearTimeout(this.chordTimeout);
      this.chordTimeout = null;
    }
  }

  private registerGlobal(): void {
    // Navigation — all require 'q' prefix chord to prevent accidental triggers
    this.register({ key: 'd', chord: 'q', description: 'Go to Dashboard',    action: () => this.router.navigate(['/dashboard']),    context: 'Navigation' });
    this.register({ key: 'k', chord: 'q', description: 'Go to Kanban',        action: () => this.router.navigate(['/kanban']),       context: 'Navigation' });
    this.register({ key: 'b', chord: 'q', description: 'Go to Backlog',       action: () => this.router.navigate(['/backlog']),      context: 'Navigation' });
    this.register({ key: 'p', chord: 'q', description: 'Go to Parts',         action: () => this.router.navigate(['/parts']),        context: 'Navigation' });
    this.register({ key: 'i', chord: 'q', description: 'Go to Inventory',     action: () => this.router.navigate(['/inventory']),    context: 'Navigation' });
    this.register({ key: 'r', chord: 'q', description: 'Go to Reports',       action: () => this.router.navigate(['/reports']),      context: 'Navigation' });
    this.register({ key: 't', chord: 'q', description: 'Go to Time Tracking', action: () => this.router.navigate(['/time-tracking']), context: 'Navigation' });

    // General — plain shortcuts remain (non-alpha, low accidental risk)
    this.register({ key: '/', description: 'Show keyboard shortcuts', action: () => this.toggleHelp(), context: 'General' });
    this.register({ key: 'Escape', description: 'Close panel/dialog',  action: () => this.closeHelp(), context: 'General' });
  }

  private buildKey(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  private buildKeyFromShortcut(s: Pick<KeyboardShortcut, 'key' | 'modifiers' | 'chord'>): string {
    if (s.chord) {
      return `${s.chord.toLowerCase()}+${s.key.toLowerCase()}`;
    }
    const parts: string[] = [];
    if (s.modifiers?.includes('ctrl') || s.modifiers?.includes('meta')) parts.push('ctrl');
    if (s.modifiers?.includes('alt')) parts.push('alt');
    if (s.modifiers?.includes('shift')) parts.push('shift');
    parts.push(s.key.toLowerCase());
    return parts.join('+');
  }
}
