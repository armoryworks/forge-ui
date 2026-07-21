import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { Observable, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DiscoveryAnswer,
  DiscoveryRecommendation,
} from '../models/discovery-recommendation.model';
import {
  DiscoveryQuestion,
  DiscoveryQuestionsResponse,
} from '../models/discovery-question.model';

/**
 * Phase 4 Phase-F — Discovery wizard state + API client.
 *
 * Holds the question catalog (loaded once per session) and the running
 * answer set (mutable as the user advances). Exposes `preview()` for
 * stateless recommendation lookup and `apply()` for the final commit.
 *
 * Branch routing is computed locally so the UI can filter questions
 * before showing them to the user (per 4C: branch routing happens after
 * the opening 6 questions). The server's recommendation engine still
 * runs the full algorithm — the UI's local routing is purely for
 * rendering.
 */
@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private readonly http = inject(HttpClient);

  private readonly _questions = signal<DiscoveryQuestion[]>([]);
  private readonly _answers = signal<Map<string, string>>(new Map());
  private readonly _recommendation = signal<DiscoveryRecommendation | null>(null);
  private readonly _consultantMode = signal<boolean>(false);
  private readonly _loading = signal<boolean>(false);
  private readonly _previewing = signal<boolean>(false);
  private readonly _applying = signal<boolean>(false);
  private readonly _startedAt = signal<string | null>(null);

  readonly questions = this._questions.asReadonly();
  readonly answers = this._answers.asReadonly();
  readonly recommendation = this._recommendation.asReadonly();
  readonly consultantMode = this._consultantMode.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly previewing = this._previewing.asReadonly();
  readonly applying = this._applying.asReadonly();

  /** Headcount bucket inferred from Q-O1, used for branch routing. */
  readonly headcountBucket = computed<string>(() => {
    const raw = this._answers().get('Q-O1') ?? '';
    if (raw === '1-2') return 'small';
    if (raw === '3-10' || raw === '11-25') return 'small-mid';
    if (raw === '26-50' || raw === '51-200') return 'mid';
    if (raw === '200+') return 'large';
    return '';
  });

  /** Mode (production / distribution / hybrid) inferred from Q-O3. */
  readonly mode = computed<string>(() => {
    const raw = this._answers().get('Q-O3') ?? '';
    if (raw === 'make') return 'production';
    if (raw === 'resell') return 'distribution';
    if (raw === 'both') return 'hybrid';
    return '';
  });

  /** Sites bucket inferred from Q-O5. */
  readonly sitesBucket = computed<string>(() => {
    const raw = this._answers().get('Q-O5') ?? '';
    if (raw === '1') return 'single';
    if (raw === '2') return 'dual';
    if (raw === '3+') return 'multi';
    return '';
  });

  /** The branch the user is routed to ("A", "B", "C", or "" before routing). */
  readonly branch = computed<string>(() => {
    const headcount = this.headcountBucket();
    const sites = this.sitesBucket();
    if (!headcount) return '';
    // Per 4C decision #4: multi-site = yes always routes to Branch C
    if ((sites === 'dual' || sites === 'multi') && headcount !== 'small') return 'C';
    if (headcount === 'small' || headcount === 'small-mid') return 'A';
    if (headcount === 'mid') return 'B';
    if (headcount === 'large') return 'C';
    return 'B';
  });

  /**
   * Filters the catalog down to the questions the current user should see —
   * opening + branch-applicable + override + diagnostic. Consultant
   * deepdives are surfaced only when consultant mode is on. Exit (Q-X1)
   * is excluded — it's the header skip link, not a step.
   */
  readonly visibleQuestions = computed<DiscoveryQuestion[]>(() => {
    const branch = this.branch();
    const consultant = this._consultantMode();
    const mode = this.mode();
    const all = this._questions();

    return all.filter((q) => {
      // Exit (Q-X1) is the skip-to-Custom ramp, surfaced as the persistent
      // header link (exitToCustom) — never as a numbered wizard step. Its
      // text references preset descriptions that a sequential step never
      // shows, so rendering it as a question reads as broken.
      if (q.stage === 'Exit') return false;

      // Opening, override, diagnostic always visible.
      if (
        q.stage === 'Opening' ||
        q.stage === 'Override' ||
        q.stage === 'Diagnostic'
      ) {
        // Consultant deepdive is filtered by category, not stage.
        if (q.category === 'ConsultantDeepdive' && !consultant) return false;
        return true;
      }

      // Branch-specific: only show the active branch's questions.
      if (q.stage === 'BranchA' && branch !== 'A') return false;
      if (q.stage === 'BranchB' && branch !== 'B') return false;
      if (q.stage === 'BranchC' && branch !== 'C') return false;

      // Branch A's distribution-only question (Q-A4) skipped for production-only mode.
      if (q.id === 'Q-A4' && mode === 'production') return false;

      // Consultant deepdive: only surfaced when consultant mode is on AND the
      // user is in that branch.
      if (q.category === 'ConsultantDeepdive') {
        if (!consultant) return false;
        if (q.branch !== branch) return false;
      }

      return true;
    });
  });

  /** Has the user given enough answers for a meaningful preview? */
  readonly canPreview = computed<boolean>(
    () => !!this._answers().get('Q-O1') && !!this._answers().get('Q-O3'),
  );

  loadQuestions(consultantMode: boolean = false): Observable<DiscoveryQuestionsResponse> {
    this._loading.set(true);
    this._consultantMode.set(consultantMode);
    if (!this._startedAt()) {
      this._startedAt.set(new Date().toISOString());
    }
    const url = `${environment.apiUrl}/discovery/questions${consultantMode ? '?mode=consultant' : ''}`;
    return this.http.get<DiscoveryQuestionsResponse>(url).pipe(
      tap((res) => {
        this._questions.set(res.questions);
        this._loading.set(false);
      }),
    );
  }

  setConsultantMode(on: boolean): void {
    this._consultantMode.set(on);
    this.loadQuestions(on).subscribe();
  }

  setAnswer(questionId: string, value: string): void {
    const next = new Map(this._answers());
    next.set(questionId, value);
    this._answers.set(next);
  }

  clearAnswer(questionId: string): void {
    const next = new Map(this._answers());
    next.delete(questionId);
    this._answers.set(next);
  }

  reset(): void {
    this._answers.set(new Map());
    this._recommendation.set(null);
    this._startedAt.set(null);
  }

  /**
   * Stateless preview — does not persist anything. Used reactively as
   * the user fills in answers so the recommendation card can update live.
   */
  preview(): Observable<DiscoveryRecommendation | null> {
    if (!this.canPreview()) {
      return of(null);
    }
    this._previewing.set(true);
    const answers = this.answersAsArray();
    return this.http
      .post<DiscoveryRecommendation>(`${environment.apiUrl}/discovery/preview`, { answers })
      .pipe(
        tap((rec) => {
          this._recommendation.set(rec);
          this._previewing.set(false);
        }),
      );
  }

  /**
   * Persist a DiscoveryRun and atomically apply the chosen preset's deltas.
   * Returns the final recommendation tuple (with empty deltas after apply).
   */
  apply(chosenPresetId: string): Observable<DiscoveryRecommendation> {
    this._applying.set(true);
    const answers = this.answersAsArray();
    const consultantMode = this._consultantMode();
    const startedAt = this._startedAt();
    return this.http
      .post<DiscoveryRecommendation>(`${environment.apiUrl}/discovery/apply`, {
        answers,
        chosenPresetId,
        consultantMode,
        startedAt,
      })
      .pipe(
        tap(() => {
          this._applying.set(false);
        }),
      );
  }

  private answersAsArray(): DiscoveryAnswer[] {
    return Array.from(this._answers().entries()).map(([questionId, value]) => ({
      questionId,
      value,
    }));
  }
}
