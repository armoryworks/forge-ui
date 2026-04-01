import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { MentionUser } from '../../models/mention-user.model';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
})
export class RichTextEditorComponent implements ControlValueAccessor {
  @ViewChild('textarea') private readonly textareaRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChildren('mentionOption') private readonly mentionOptions!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly placeholder = input('');
  readonly users = input<MentionUser[]>([]);
  readonly rows = input(4);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly showMentionPicker = signal(false);
  protected readonly activeIndex = signal(-1);

  /** The text typed after the triggering `@` (no spaces, up to cursor). */
  private mentionQuery = signal('');
  /** Character index in the textarea where the triggering `@` was typed. */
  private mentionStartIndex = -1;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  /** Filtered users matching the current mention query (max 8). */
  protected readonly filteredUsers = computed(() => {
    const query = this.mentionQuery().trim().toLowerCase();
    if (query === '') return this.users().slice(0, 8);
    return this.users()
      .filter(
        u =>
          u.name.toLowerCase().includes(query) ||
          u.initials.toLowerCase().includes(query),
      )
      .slice(0, 8);
  });

  /** Parsed unique user IDs from all `@[Name](user:ID)` patterns in the value. */
  readonly mentionedUserIds = computed(() => {
    const matches = [...this.value().matchAll(/@\[([^\]]+)\]\(user:(\d+)\)/g)];
    return [...new Set(matches.map(m => parseInt(m[2], 10)))];
  });

  // ── CVA ────────────────────────────────────────────────────────────────────

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ── Event Handlers ─────────────────────────────────────────────────────────

  protected onInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const raw = textarea.value;

    // Auto-resize
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;

    this.value.set(raw);
    this.onChange(raw);
    this.detectMentionTrigger(textarea);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.showMentionPicker()) return;

    const users = this.filteredUsers();
    const idx = this.activeIndex();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set(Math.min(idx + 1, users.length - 1));
        this.scrollActiveOptionIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(idx - 1, 0));
        this.scrollActiveOptionIntoView();
        break;
      case 'Enter':
      case ' ':
        // Space only selects when picker is open and an item is highlighted
        if (idx >= 0 && idx < users.length) {
          event.preventDefault();
          this.selectMention(users[idx]);
        }
        break;
      case 'Escape':
        this.showMentionPicker.set(false);
        this.activeIndex.set(-1);
        event.stopPropagation();
        break;
    }
  }

  protected onBlur(): void {
    this.onTouched();
    // Delay so a mousedown on a picker option registers before blur hides it
    setTimeout(() => {
      this.showMentionPicker.set(false);
      this.activeIndex.set(-1);
    }, 200);
  }

  protected selectMention(user: MentionUser): void {
    const textarea = this.textareaRef.nativeElement;
    const current = textarea.value;
    const before = current.slice(0, this.mentionStartIndex);
    const cursorPos = textarea.selectionStart;
    const after = current.slice(cursorPos);
    const inserted = `@[${user.name}](user:${user.id})`;
    const newValue = `${before}${inserted}${after}`;
    const newCursor = before.length + inserted.length;

    this.value.set(newValue);
    this.onChange(newValue);
    this.showMentionPicker.set(false);
    this.activeIndex.set(-1);
    this.mentionStartIndex = -1;
    this.mentionQuery.set('');

    // Restore cursor position after Angular re-renders
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newCursor, newCursor);
      textarea.focus();
      // Re-run auto-resize
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }

  // ── Mention Detection ──────────────────────────────────────────────────────

  private detectMentionTrigger(textarea: HTMLTextAreaElement): void {
    const cursor = textarea.selectionStart;
    const textBeforeCursor = textarea.value.slice(0, cursor);

    // Find the last `@` before cursor that is not already part of a formatted mention
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) {
      this.showMentionPicker.set(false);
      return;
    }

    const afterAt = textBeforeCursor.slice(atIndex + 1);

    // Close picker only on newline — spaces are allowed so users can search "Last, First" style names
    if (afterAt.includes('\n')) {
      this.showMentionPicker.set(false);
      return;
    }

    // Check the character immediately before `@` — must be start-of-string, space, or newline
    const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
    if (charBefore !== ' ' && charBefore !== '\n' && atIndex !== 0) {
      this.showMentionPicker.set(false);
      return;
    }

    this.mentionStartIndex = atIndex;
    this.mentionQuery.set(afterAt);
    this.showMentionPicker.set(true);
    // Reset active index whenever the query changes so navigation starts fresh
    this.activeIndex.set(-1);
  }

  private scrollActiveOptionIntoView(): void {
    const idx = this.activeIndex();
    if (idx < 0) return;
    requestAnimationFrame(() => {
      const options = this.mentionOptions?.toArray();
      if (options && options[idx]) {
        options[idx].nativeElement.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.showMentionPicker()) return;
    const host = this.textareaRef?.nativeElement;
    if (host && !host.closest('.rte')?.contains(event.target as Node)) {
      this.showMentionPicker.set(false);
      this.activeIndex.set(-1);
    }
  }
}
