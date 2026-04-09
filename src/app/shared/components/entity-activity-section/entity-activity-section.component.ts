import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, computed, effect, inject,
  input, OnInit, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatTooltipModule } from '@angular/material/tooltip';

import { EntityActivityService } from '../../services/entity-activity.service';
import { ActivityItem } from '../../models/activity.model';
import { EntityNote } from '../../models/entity-note.model';
import { MentionUser } from '../../models/mention-user.model';
import { AvatarComponent } from '../avatar/avatar.component';
import { ActivityTimelineComponent } from '../activity-timeline/activity-timeline.component';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { RichTextDisplayComponent } from '../rich-text-display/rich-text-display.component';

export type ActivityFilterTab = 'all' | 'comments' | 'notes' | 'history';

@Component({
  selector: 'app-entity-activity-section',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatTooltipModule,
    AvatarComponent,
    ActivityTimelineComponent,
    RichTextEditorComponent,
    RichTextDisplayComponent,
  ],
  templateUrl: './entity-activity-section.component.html',
  styleUrl: './entity-activity-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityActivitySectionComponent implements OnInit {
  private readonly activityService = inject(EntityActivityService);

  readonly entityType = input.required<string>();
  readonly entityId = input.required<number>();
  readonly tabs = input<ActivityFilterTab[]>(['all', 'comments', 'notes', 'history']);

  protected readonly activeFilter = signal<ActivityFilterTab>('all');
  protected readonly activity = signal<ActivityItem[]>([]);
  protected readonly notes = signal<EntityNote[]>([]);
  protected readonly historyItems = signal<ActivityItem[]>([]);
  protected readonly mentionUsers = signal<MentionUser[]>([]);
  protected readonly isSavingNote = signal(false);

  protected readonly commentControl = new FormControl('');
  protected readonly noteControl = new FormControl('');

  protected readonly showFilterBar = computed(() => this.tabs().length > 1);

  protected readonly mappedComments = computed(() =>
    this.activity().filter(a => a.action === 'Comment'),
  );

  protected readonly allActivityItems = computed<ActivityItem[]>(() => {
    const comments = this.mappedComments();
    const noteItems: ActivityItem[] = this.notes().map(n => ({
      id: n.id,
      description: n.text,
      createdAt: n.createdAt,
      userInitials: n.authorInitials ?? undefined,
      action: 'note',
    }));
    return [...comments, ...noteItems].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  });

  constructor() {
    // Reload data when entityId changes
    effect(() => {
      const id = this.entityId();
      const type = this.entityType();
      if (id && type) {
        this.loadData(type, id);
      }
    });
  }

  ngOnInit(): void {
    this.activityService.getMentionUsers().subscribe(u => this.mentionUsers.set(u));
  }

  protected setFilter(tab: ActivityFilterTab): void {
    this.activeFilter.set(tab);
  }

  protected postComment(): void {
    const text = (this.commentControl.value ?? '').trim();
    if (!text) return;
    const mentionIds = this.extractMentionIds(text);
    this.activityService.postComment(this.entityType(), this.entityId(), text, mentionIds)
      .subscribe(entry => {
        this.activity.update(list => [entry, ...list]);
        this.commentControl.reset();
      });
  }

  protected saveNote(): void {
    const text = (this.noteControl.value ?? '').trim();
    if (!text) return;
    const mentionIds = this.extractMentionIds(text);
    this.isSavingNote.set(true);
    this.activityService.createNote(this.entityType(), this.entityId(), text, mentionIds)
      .subscribe({
        next: note => {
          this.notes.update(n => [note, ...n]);
          this.noteControl.reset();
          this.isSavingNote.set(false);
        },
        error: () => this.isSavingNote.set(false),
      });
  }

  protected deleteNote(note: EntityNote): void {
    this.activityService.deleteNote(this.entityType(), this.entityId(), note.id)
      .subscribe(() => {
        this.notes.update(list => list.filter(n => n.id !== note.id));
      });
  }

  private loadData(entityType: string, entityId: number): void {
    const availableTabs = this.tabs();

    if (availableTabs.includes('all') || availableTabs.includes('comments')) {
      this.activityService.getActivity(entityType, entityId)
        .subscribe(a => this.activity.set(a));
    }

    if (availableTabs.includes('notes') || availableTabs.includes('all')) {
      this.activityService.getNotes(entityType, entityId)
        .subscribe(n => this.notes.set(n));
    }

    if (availableTabs.includes('history')) {
      this.activityService.getHistory(entityType, entityId)
        .subscribe(h => this.historyItems.set(h));
    }
  }

  private extractMentionIds(text: string): number[] {
    const matches = [...text.matchAll(/@\[([^\]]+)\]\(user:(\d+)\)/g)];
    return [...new Set(matches.map(m => parseInt(m[2], 10)))];
  }
}
