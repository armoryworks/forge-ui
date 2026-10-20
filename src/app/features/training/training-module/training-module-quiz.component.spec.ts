import { ElementRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';

import { TrainingModuleQuizComponent } from './training-module-quiz.component';
import { TrainingService } from '../services/training.service';
import { QuizSubmissionResult } from '../models/quiz-content.model';

interface QuizInternals {
  result: { set(r: QuizSubmissionResult | null): void };
  scoreLabel(): string;
  retry(): void;
  submit(): void;
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

  it.each([[409, 1], [500, 0]])('after a %i on submit, asks the parent for a fresh question set %i time(s)', (status, times) => {
    const submitQuiz = vi.fn(() => throwError(() => new HttpErrorResponse({ status })));
    TestBed.configureTestingModule({ providers: [{ provide: TrainingService, useValue: { submitQuiz } }] });
    const fixture = TestBed.createComponent(TrainingModuleQuizComponent);
    fixture.componentRef.setInput('content', {
      shuffleQuestions: false, shuffleOptions: false, showExplanationsAfterSubmit: false, questions: [],
    });
    fixture.componentRef.setInput('moduleId', 9);
    const requested = vi.fn();
    fixture.componentInstance.retryRequested.subscribe(requested);

    (fixture.componentInstance as unknown as QuizInternals).submit();

    expect(submitQuiz).toHaveBeenCalledWith(9, []);
    expect(requested).toHaveBeenCalledTimes(times);
  });
});
