import { describe, expect, it } from 'vitest';

import { evaluateCalcExpression } from './calc-expression';

function value(text: string, lang = 'en'): number | null {
  const result = evaluateCalcExpression(text, lang);
  if (result.error !== null) throw new Error(`${text} → ${result.error}`);
  return result.value;
}

function error(text: string, lang = 'en'): string | null {
  return evaluateCalcExpression(text, lang).error;
}

describe('evaluateCalcExpression', () => {
  describe('the requested examples', () => {
    it.each([
      ['360+64', 424],
      ['3/4', 0.75],
      ['13/16', 0.8125],
      ['1 3/16', 1.1875],
    ])('%s = %d', (text, expected) => {
      expect(value(text)).toBe(expected);
    });
  });

  describe('plain numbers', () => {
    it.each([
      ['0', 0],
      ['42', 42],
      ['0.75', 0.75],
      ['.5', 0.5],
      ['5.', 5],
      ['-3', -3],
      ['+3', 3],
      ['1,500.25', 1500.25],
      ['1,234,567', 1234567],
      ['  7  ', 7],
    ])('%s = %d', (text, expected) => {
      expect(value(text)).toBe(expected);
    });

    it('gives null for blank text', () => {
      expect(evaluateCalcExpression('', 'en')).toEqual({ value: null, error: null });
      expect(evaluateCalcExpression('   ', 'en')).toEqual({ value: null, error: null });
      expect(evaluateCalcExpression(null, 'en')).toEqual({ value: null, error: null });
      expect(evaluateCalcExpression(undefined, 'en')).toEqual({ value: null, error: null });
    });
  });

  describe('arithmetic', () => {
    it.each([
      ['1+2', 3],
      ['10-4', 6],
      ['6*7', 42],
      ['9/4', 2.25],
      ['2+3*4', 14],
      ['(2+3)*4', 20],
      ['10-4-3', 3],
      ['24/4/2', 3],
      ['2*(3+(4-1))', 12],
      ['((((5))))', 5],
      ['100 - 2.5 * 4', 90],
      [' 360 + 64 ', 424],
    ])('%s = %d', (text, expected) => {
      expect(value(text)).toBe(expected);
    });

    it('trims binary artefacts from the result', () => {
      expect(value('0.1+0.2')).toBe(0.3);
      expect(value('0.75*25.4')).toBe(19.05);
      expect(value('1.1*3')).toBe(3.3);
    });

    it('keeps the full precision of a repeating result for the field to round', () => {
      expect(value('1/3')).toBe(0.333333333333333);
      expect(value('2/3')).toBe(0.666666666666667);
    });
  });

  describe('unary signs', () => {
    it.each([
      ['-5+3', -2],
      ['3--2', 5],
      ['3+-2', 1],
      ['-(2+3)', -5],
      ['--4', 4],
      ['-3*-2', 6],
      ['2*-3', -6],
      ['-3/4', -0.75],
    ])('%s = %d', (text, expected) => {
      expect(value(text)).toBe(expected);
    });

    it('never returns negative zero', () => {
      expect(Object.is(value('-0'), 0)).toBe(true);
      expect(Object.is(value('0*-1'), 0)).toBe(true);
    });
  });

  describe('fractions and mixed numbers', () => {
    it.each([
      ['1/2', 0.5],
      ['5/8', 0.625],
      ['1/32', 0.03125],
      ['2 1/2', 2.5],
      ['1   3/16', 1.1875],
      ['-1 3/16', -1.1875],
      ['1 3/16 + 1/16', 1.25],
      ['2 * 1 1/2', 3],
      ['(1 1/2)', 1.5],
      ['1 3/16 / 2', 0.59375],
      ['12 5/4', 13.25],
      ['0 3/4', 0.75],
    ])('%s = %d', (text, expected) => {
      expect(value(text)).toBe(expected);
    });

    it('reads a decimal followed by a fraction as invalid, not as a mixed number', () => {
      expect(error('1.5 1/2')).toBe('invalid');
      expect(error('1 1.5/2')).toBe('invalid');
    });

    it('treats 1 3 / 16 with a spaced slash the same as 1 3/16', () => {
      expect(value('1 3 / 16')).toBe(1.1875);
    });

    it('needs whitespace between the whole number and the fraction', () => {
      expect(error('13/16 1')).toBe('invalid');
    });
  });

  describe('symbol aliases', () => {
    it.each([
      ['6×7', 42],
      ['9÷4', 2.25],
      ['10−4', 6],
      ['3 × 1 1/2', 4.5],
    ])('%s = %d', (text, expected) => {
      expect(value(text)).toBe(expected);
    });
  });

  describe('invalid input', () => {
    it.each([
      'abc',
      '1+',
      '*2',
      '2*',
      '(1+2',
      '1+2)',
      '()',
      '1 2',
      '2(3)',
      '(2)(3)',
      '1..2',
      '1,50',
      '1,5000',
      '1,500,00',
      '1e3',
      '3/4/',
      '+',
      '-',
      '.',
      '2^3',
      '1;2',
      'Infinity',
      'NaN',
      '0x10',
      'alert(1)',
      '1 + 2 // 3',
    ])('%s is invalid', (text) => {
      expect(error(text)).toBe('invalid');
    });

    it('rejects text longer than 200 characters', () => {
      expect(error('1+'.repeat(100) + '1')).toBe('invalid');
    });

    it('rejects nesting deeper than 32 levels instead of overflowing the stack', () => {
      expect(error('('.repeat(40) + '1' + ')'.repeat(40))).toBe('invalid');
      expect(error('-'.repeat(40) + '1')).toBe('invalid');
      expect(value('('.repeat(10) + '1' + ')'.repeat(10))).toBe(1);
    });
  });

  describe('division by zero', () => {
    it.each(['1/0', '0/0', '5/(2-2)', '1 3/0', '-4/0', '1/0+1'])('%s divides by zero', (text) => {
      expect(error(text)).toBe('divideByZero');
    });

    it('allows a zero numerator', () => {
      expect(value('0/5')).toBe(0);
    });
  });

  describe('locale separators', () => {
    it('reads es with the es-US conventions Forge uses (dot decimal, comma group)', () => {
      expect(value('1.5+1', 'es')).toBe(2.5);
      expect(value('1,500/2', 'es')).toBe(750);
      expect(error('1,5', 'es')).toBe('invalid');
    });

    it('reads a comma-decimal locale with a comma decimal and a dot group', () => {
      expect(value('1,5+1', 'de-DE')).toBe(2.5);
      expect(value('0,75*4', 'de-DE')).toBe(3);
      expect(value('1.500,25-0,25', 'de-DE')).toBe(1500);
      expect(value('1 3/16', 'de-DE')).toBe(1.1875);
      expect(error('1.5', 'de-DE')).toBe('invalid');
    });

    it('ignores a whitespace group separator rather than misreading mixed numbers', () => {
      expect(value('1 3/16', 'fr-FR')).toBe(1.1875);
      expect(value('2,5*2', 'fr-FR')).toBe(5);
    });
  });
});
