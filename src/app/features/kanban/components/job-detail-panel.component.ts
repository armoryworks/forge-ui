import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { KanbanService } from '../services/kanban.service';
import { JobDetail, Subtask, Activity, JobLink, KanbanJob, PRIORITY_COLORS, LINK_TYPE_OPTIONS, LINK_TYPE_ICONS, LINK_TYPE_LABELS } from '../models/kanban.model';

@Component({
  selector: 'app-job-detail-panel',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent],
  templateUrl: './job-detail-panel.component.html',
  styleUrl: './job-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDetailPanelComponent implements OnInit {
  private readonly kanbanService = inject(KanbanService);

  readonly jobId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<JobDetail>();

  protected readonly job = signal<JobDetail | null>(null);
  protected readonly subtasks = signal<Subtask[]>([]);
  protected readonly activity = signal<Activity[]>([]);
  protected readonly links = signal<JobLink[]>([]);
  protected readonly loading = signal(true);
  protected readonly newSubtaskControl = new FormControl('');
  protected readonly commentControl = new FormControl('');

  // Link add form
  protected readonly linkSearchControl = new FormControl('');
  protected readonly linkTypeControl = new FormControl('RelatedTo');
  protected readonly linkTypeOptions = LINK_TYPE_OPTIONS;
  protected readonly linkTypeIcons = LINK_TYPE_ICONS;
  protected readonly linkTypeLabels = LINK_TYPE_LABELS;
  protected readonly linkSearchResults = signal<KanbanJob[]>([]);
  protected readonly selectedLinkTarget = signal<KanbanJob | null>(null);
  protected readonly showLinkResults = signal(false);

  ngOnInit(): void {
    const id = this.jobId();
    this.kanbanService.getJobDetail(id).subscribe(detail => {
      this.job.set(detail);
      this.loading.set(false);
    });
    this.kanbanService.getSubtasks(id).subscribe(s => this.subtasks.set(s));
    this.kanbanService.getJobActivity(id).subscribe(a => this.activity.set(a));
    this.kanbanService.getJobLinks(id).subscribe(l => this.links.set(l));

    this.linkSearchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => (v?.length ?? 0) >= 2),
      switchMap(term => this.kanbanService.searchJobs(term!)),
    ).subscribe(results => {
      // Exclude the current job and already-linked jobs
      const currentId = this.jobId();
      const linkedIds = new Set(this.links().map(l => l.linkedJobId));
      this.linkSearchResults.set(
        results.filter(j => j.id !== currentId && !linkedIds.has(j.id)).slice(0, 8)
      );
      this.showLinkResults.set(true);
    });
  }

  protected priorityColor(priority: string): string {
    return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS['Normal'];
  }

  protected formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  protected formatActivityDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  protected completedCount(): number {
    return this.subtasks().filter(s => s.isCompleted).length;
  }

  protected toggleSubtask(subtask: Subtask): void {
    const newState = !subtask.isCompleted;
    subtask.isCompleted = newState;
    subtask.completedAt = newState ? new Date().toISOString() : null;
    this.subtasks.update(list => [...list]);
    this.kanbanService.toggleSubtask(this.jobId(), subtask.id, newState).subscribe();
  }

  protected addSubtask(): void {
    const text = (this.newSubtaskControl.value ?? '').trim();
    if (!text) return;
    this.kanbanService.addSubtask(this.jobId(), text).subscribe(st => {
      this.subtasks.update(list => [...list, st]);
      this.newSubtaskControl.reset();
    });
  }

  protected selectLinkTarget(job: KanbanJob): void {
    this.selectedLinkTarget.set(job);
    this.linkSearchControl.setValue(job.jobNumber + ' — ' + job.title, { emitEvent: false });
    this.showLinkResults.set(false);
  }

  protected addLink(): void {
    const target = this.selectedLinkTarget();
    const linkType = this.linkTypeControl.value ?? 'RelatedTo';
    if (!target) return;

    this.kanbanService.createJobLink(this.jobId(), target.id, linkType).subscribe(link => {
      this.links.update(list => [...list, link]);
      this.selectedLinkTarget.set(null);
      this.linkSearchControl.reset();
      this.linkTypeControl.setValue('RelatedTo');
    });
  }

  protected deleteLink(link: JobLink): void {
    this.kanbanService.deleteJobLink(this.jobId(), link.id).subscribe(() => {
      this.links.update(list => list.filter(l => l.id !== link.id));
    });
  }

  protected dismissLinkResults(): void {
    // Small delay to allow click on result
    setTimeout(() => this.showLinkResults.set(false), 200);
  }

  protected postComment(): void {
    const text = (this.commentControl.value ?? '').trim();
    if (!text) return;
    this.kanbanService.addComment(this.jobId(), text).subscribe(entry => {
      this.activity.update(list => [entry, ...list]);
      this.commentControl.reset();
    });
  }

  protected isComment(a: Activity): boolean {
    return a.action === 'CommentAdded';
  }

  protected close(): void {
    this.closed.emit();
  }
}
