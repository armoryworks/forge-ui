import { describe, it, expect } from 'vitest';

import { trainingContentIcon } from './training-content-icon';

describe('trainingContentIcon', () => {
  it('maps each content type to an outlined icon', () => {
    expect(trainingContentIcon('Article')).toBe('article');
    expect(trainingContentIcon('Video')).toBe('play_circle');
    expect(trainingContentIcon('Walkthrough')).toBe('route');
    expect(trainingContentIcon('Quiz')).toBe('quiz');
    expect(trainingContentIcon('Reference')).toBe('menu_book');
  });

  it('uses an icon the outlined font has for quick references', () => {
    expect(trainingContentIcon('QuickRef')).toBe('fact_check');
  });

  it('falls back to school for unknown or missing types', () => {
    expect(trainingContentIcon('Podcast')).toBe('school');
    expect(trainingContentIcon(null)).toBe('school');
    expect(trainingContentIcon(undefined)).toBe('school');
  });
});
