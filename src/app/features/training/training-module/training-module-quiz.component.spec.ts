import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TrainingModuleQuizComponent } from './training-module-quiz.component';
import { TrainingService } from '../services/training.service';
import { QuizSubmissionResult } from '../models/quiz-content.model';

interface QuizInternals {
  result: { set(r: QuizSubmissionResult | null): void };
  scoreLabel(): string;
  retry(): void;
}

describe('TrainingModuleQuizComponent', () => {
  function create(): { quiz: TrainingModuleQuizComponent; internals: QuizInternals } {
    TestBed.configureTestingModule({ providers: [
      { provide: TrainingService, useValue: {} },
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
    ] });
    const quiz = TestBed.runInInjectionContext(() => new TrainingModuleQuizComponent());
    return { quiz, internals: quiz as unknown as QuizInternals };
  }

  it('states the passing score the server returned on a failed attempt', () => {
    const { internals } = create();
    internals.result.set({ score: 50, passed: false, passingScore: 80, questions: [] });

    expect(internals.scoreLabel()).toContain('80%');
    expect(internals.scoreLabel()).not.toContain('undefined');
  });

  it('asks the parent for a fresh question set on retry', () => {
    const { quiz, internals } = create();
    const requested = vi.fn();
    quiz.retryRequested.subscribe(requested);

    internals.retry();

    expect(requested).toHaveBeenCalledTimes(1);
  });
});
