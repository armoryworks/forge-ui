import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { KeyboardShortcutsService, KeyboardShortcut } from '../../services/keyboard-shortcuts.service';

interface ShortcutGroup {
  context: string;
  shortcuts: KeyboardShortcut[];
}

@Component({
  selector: 'app-keyboard-shortcuts-help',
  standalone: true,
  imports: [],
  templateUrl: './keyboard-shortcuts-help.component.html',
  styleUrl: './keyboard-shortcuts-help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyboardShortcutsHelpComponent {
  protected readonly shortcuts = inject(KeyboardShortcutsService);

  protected readonly groups = computed<ShortcutGroup[]>(() => {
    // Re-read helpOpen to ensure reactivity triggers re-compute
    this.shortcuts.helpOpen();

    const all = this.shortcuts.getAll();
    const map = new Map<string, KeyboardShortcut[]>();

    for (const s of all) {
      const ctx = s.context ?? 'Other';
      const list = map.get(ctx) ?? [];
      list.push(s);
      map.set(ctx, list);
    }

    return Array.from(map.entries()).map(([context, shortcuts]) => ({ context, shortcuts }));
  });

  protected formatKey(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.modifiers?.includes('ctrl') || shortcut.modifiers?.includes('meta')) parts.push('Ctrl');
    if (shortcut.modifiers?.includes('alt')) parts.push('Alt');
    if (shortcut.modifiers?.includes('shift')) parts.push('Shift');

    const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
    parts.push(key);

    return parts.join(' + ');
  }
}
