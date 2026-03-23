import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { TrainingService } from '../services/training.service';
import { QuizAnswer, QuizContent, QuizSubmissionResult } from '../models/quiz-content.model';

@Component({
  selector: 'app-training-module-quiz',
  standalone: true,
  imports: [],
  templateUrl: './training-module-quiz.component.html',
  styleUrl: './training-module-quiz.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingModuleQuizComponent {
  private readonly trainingService = inject(TrainingService);

  readonly content = input.required<QuizContent>();
  readonly moduleId = input.required<number>();

  readonly completed = output<boolean>();

  protected readonly answers = signal<Map<string, string>>(new Map());
  protected readonly submitted = signal(false);
  protected readonly result = signal<QuizSubmissionResult | null>(null);
  protected readonly isSubmitting = signal(false);

  protected readonly allAnswered = computed(() =>
    this.content().questions.every(q => this.answers().has(q.id)),
  );

  protected selectOption(questionId: string, optionId: string): void {
    if (this.submitted()) return;
    this.answers.update(map => {
      const updated = new Map(map);
      updated.set(questionId, optionId);
      return updated;
    });
  }

  protected isSelected(questionId: string, optionId: string): boolean {
    return this.answers().get(questionId) === optionId;
  }

  protected submit(): void {
    if (!this.allAnswered() || this.isSubmitting()) return;

    const answersArray: QuizAnswer[] = Array.from(this.answers().entries()).map(([questionId, optionId]) => ({
      questionId,
      optionId,
    }));

    this.isSubmitting.set(true);
    this.trainingService.submitQuiz(this.moduleId(), answersArray).subscribe({
      next: result => {
        this.result.set(result);
        this.submitted.set(true);
        this.isSubmitting.set(false);
        this.completed.emit(result.passed);
      },
      error: () => this.isSubmitting.set(false),
    });
  }

  protected retry(): void {
    this.answers.set(new Map());
    this.submitted.set(false);
    this.result.set(null);
  }

  protected getQuestionResult(questionId: string) {
    return this.result()?.questions.find(q => q.questionId === questionId) ?? null;
  }

  protected scoreLabel(): string {
    const r = this.result();
    if (!r) return '';
    const passing = this.content().passingScore;
    if (r.passed) {
      return `Score: ${r.score}% — Passed!`;
    }
    return `Score: ${r.score}% — ${passing}% required to pass. Try again.`;
  }
}
