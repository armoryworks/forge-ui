import { numberSeparators } from './locale-number';

export type CalcErrorCode = 'invalid' | 'divideByZero';

export type CalcResult =
  | { readonly value: number | null; readonly error: null }
  | { readonly value: null; readonly error: CalcErrorCode };

type Operator = '+' | '-' | '*' | '/' | '(' | ')';

type Token =
  | { readonly kind: 'number'; readonly value: number; readonly integer: boolean; readonly spaced: boolean }
  | { readonly kind: 'operator'; readonly operator: Operator; readonly spaced: boolean };

const MAX_LENGTH = 200;
const MAX_DEPTH = 32;
const RESULT_PRECISION = 15;

const OPERATORS: Readonly<Record<string, Operator>> = {
  '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/', '(': '(', ')': ')',
};

const numberPatternCache = new Map<string, RegExp>();

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function numberPattern(decimal: string, group: string): RegExp {
  const key = `${decimal}|${group}`;
  let pattern = numberPatternCache.get(key);
  if (!pattern) {
    const d = escapeRegExp(decimal);
    const grouped = group.trim() === '' || group === decimal
      ? ''
      : `\\d{1,3}(?:${escapeRegExp(group)}\\d{3})+(?!\\d)|`;
    pattern = new RegExp(`(?:${grouped}\\d+)(?:${d}\\d*)?|${d}\\d+`, 'y');
    numberPatternCache.set(key, pattern);
  }
  return pattern;
}

function tokenize(text: string, lang: string): Token[] | null {
  const { decimal, group } = numberSeparators(lang);
  const pattern = numberPattern(decimal, group);
  const tokens: Token[] = [];
  let spaced = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      spaced = true;
      i++;
      continue;
    }
    const operator = OPERATORS[ch];
    if (operator) {
      tokens.push({ kind: 'operator', operator, spaced });
      spaced = false;
      i++;
      continue;
    }
    pattern.lastIndex = i;
    const match = pattern.exec(text);
    if (!match) return null;
    const raw = match[0];
    const normalized = (group.trim() === '' ? raw : raw.split(group).join('')).replace(decimal, '.');
    tokens.push({ kind: 'number', value: Number(normalized), integer: !raw.includes(decimal), spaced });
    spaced = false;
    i += raw.length;
  }
  return tokens;
}

function parse(tokens: Token[]): CalcResult {
  let pos = 0;
  let depth = 0;
  let error: CalcErrorCode | null = null;

  const fail = (code: CalcErrorCode): number => {
    error ??= code;
    return NaN;
  };

  const peekOperator = (offset = 0): Operator | null => {
    const token = tokens[pos + offset];
    return token?.kind === 'operator' ? token.operator : null;
  };

  const divide = (left: number, right: number): number => (right === 0 ? fail('divideByZero') : left / right);

  const mixedFraction = (whole: number): number => {
    const numerator = tokens[pos];
    const slash = tokens[pos + 1];
    const denominator = tokens[pos + 2];
    if (
      numerator?.kind !== 'number' || !numerator.integer || !numerator.spaced
      || slash?.kind !== 'operator' || slash.operator !== '/'
      || denominator?.kind !== 'number' || !denominator.integer
    ) {
      return whole;
    }
    pos += 3;
    return whole + divide(numerator.value, denominator.value);
  };

  const primary = (): number => {
    const token = tokens[pos];
    if (!token) return fail('invalid');
    if (token.kind === 'number') {
      pos++;
      return token.integer ? mixedFraction(token.value) : token.value;
    }
    if (token.operator !== '(') return fail('invalid');
    pos++;
    if (++depth > MAX_DEPTH) return fail('invalid');
    const value = expression();
    depth--;
    if (peekOperator() !== ')') return fail('invalid');
    pos++;
    return value;
  };

  const unary = (): number => {
    const operator = peekOperator();
    if (operator !== '+' && operator !== '-') return primary();
    pos++;
    if (++depth > MAX_DEPTH) return fail('invalid');
    const value = unary();
    depth--;
    return operator === '-' ? -value : value;
  };

  const term = (): number => {
    let value = unary();
    for (let op = peekOperator(); error === null && (op === '*' || op === '/'); op = peekOperator()) {
      pos++;
      const right = unary();
      value = op === '*' ? value * right : divide(value, right);
    }
    return value;
  };

  const expression = (): number => {
    let value = term();
    for (let op = peekOperator(); error === null && (op === '+' || op === '-'); op = peekOperator()) {
      pos++;
      const right = term();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };

  const value = expression();
  if (error === null && pos < tokens.length) error = 'invalid';
  if (error !== null) return { value: null, error };
  if (!Number.isFinite(value)) return { value: null, error: 'invalid' };
  const trimmed = Number(value.toPrecision(RESULT_PRECISION));
  return { value: trimmed === 0 ? 0 : trimmed, error: null };
}

/**
 * Evaluates simple arithmetic typed into a numeric field, without `eval`: numbers in the app
 * language's form (`1,500.25` in en), unary minus, `+ - * /`, parentheses, `×` and `÷` as aliases,
 * fractions (`3/4`) and mixed numbers with a space between whole and fraction (`1 3/16` = 1.1875,
 * `-1 3/16` = -1.1875). Blank text gives a null value; anything else that is not a well-formed
 * expression gives `invalid`, and a division by zero gives `divideByZero`. The result is trimmed
 * to 15 significant digits so binary artefacts such as 0.1 + 0.2 = 0.30000000000000004 read 0.3.
 */
export function evaluateCalcExpression(text: string | null | undefined, lang: string): CalcResult {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return { value: null, error: null };
  if (trimmed.length > MAX_LENGTH) return { value: null, error: 'invalid' };
  const tokens = tokenize(trimmed, lang);
  return tokens ? parse(tokens) : { value: null, error: 'invalid' };
}
