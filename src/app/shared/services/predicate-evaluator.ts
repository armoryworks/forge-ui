// PredicateNode types are defined alongside in workflow-predicate.model.ts —
// imported there by callers that author predicates inline. The evaluator
// itself accepts `unknown` so it can validate runtime payloads.

/**
 * Workflow Pattern Phase 4 / D6 — Twin of the server-side
 * `Forge.Api.Workflows.PredicateEvaluator` (C#). Evaluates the
 * entity-readiness predicate DSL against an entity surface (a plain JSON-ish
 * object with camelCase keys mirroring the entity's serialized shape).
 *
 * Operators v1 — must match C# semantics exactly:
 *   • `fieldPresent`             — value not null/undefined and (for strings) not whitespace-only
 *   • `fieldEquals`              — strict equality (numerics compared numerically, booleans by value)
 *   • `fieldCompare`             — eq / ne / gt / lt / gte / lte
 *   • `relationExists`           — collection length ≥ minCount (default 1)
 *   • `relationCountCompare`     — count compared by op + value
 *   • `all` / `any` / `not`      — boolean composition
 *   • `custom`                   — registry lookup; v1 returns false-with-warn when not registered
 *
 * Field/relation lookup walks the object by direct property access. Missing
 * relation members are treated as zero-length (graceful), missing fields read
 * as undefined (which then fail any non-`not` operator). Unknown predicate
 * types and malformed payloads short-circuit to false with a console warning
 * — never throw.
 *
 * Use class form (not @Injectable) so the same instance is usable in tests,
 * the WorkflowService, and any future contexts that need predicate eval
 * without DI.
 */
export type PredicateCustomFunction = (predicate: unknown, entity: unknown) => boolean;

export class PredicateEvaluator {
  private readonly registry: Map<string, PredicateCustomFunction>;

  constructor(registry?: Map<string, PredicateCustomFunction>) {
    this.registry = registry ?? new Map();
  }

  /** Register a `custom` ref handler. Later calls overwrite earlier ones. */
  register(ref: string, fn: PredicateCustomFunction): void {
    this.registry.set(ref, fn);
  }

  /**
   * Evaluate a predicate against an entity. Returns `false` (with a logged
   * warning) for malformed nodes / null entities / unknown operators —
   * mirroring the C# evaluator's "graceful false" contract.
   */
  evaluate(predicate: unknown, entity: unknown): boolean {
    if (entity === null || entity === undefined) return false;
    if (!isObject(predicate)) return false;
    const type = (predicate as { type?: unknown }).type;
    if (typeof type !== 'string') return false;

    switch (type) {
      case 'fieldPresent':
        return this.evaluateFieldPresent(predicate as { field?: unknown }, entity);
      case 'fieldEquals':
        return this.evaluateFieldEquals(predicate as { field?: unknown; value?: unknown }, entity);
      case 'fieldCompare':
        return this.evaluateFieldCompare(
          predicate as { field?: unknown; op?: unknown; value?: unknown },
          entity,
        );
      case 'relationExists':
        return this.evaluateRelationExists(
          predicate as { relation?: unknown; minCount?: unknown },
          entity,
        );
      case 'relationCountCompare':
        return this.evaluateRelationCountCompare(
          predicate as { relation?: unknown; op?: unknown; value?: unknown },
          entity,
        );
      case 'all':
        return this.evaluateAll(predicate as { of?: unknown }, entity);
      case 'any':
        return this.evaluateAny(predicate as { of?: unknown }, entity);
      case 'not':
        return this.evaluateNot(predicate as { of?: unknown }, entity);
      case 'custom':
        return this.evaluateCustom(predicate as { ref?: unknown }, entity);
      default:
        return this.warn(`Unknown predicate type '${type}'`);
    }
  }

  /**
   * Convenience: parse a JSON predicate string before evaluating. Returns
   * `false` (with warning) on malformed JSON.
   */
  evaluateJson(predicateJson: string, entity: unknown): boolean {
    if (!predicateJson || !predicateJson.trim()) return false;
    let parsed: unknown;
    try {
      parsed = JSON.parse(predicateJson);
    } catch {
      this.warn('Malformed predicate JSON');
      return false;
    }
    return this.evaluate(parsed, entity);
  }

  // ─── Operator implementations ──────────────────────────────────────────

  private evaluateFieldPresent(predicate: { field?: unknown }, entity: unknown): boolean {
    const field = readField(predicate, 'field');
    if (field === null) return false;
    const value = readMember(entity, field);
    return isPresent(value);
  }

  private evaluateFieldEquals(
    predicate: { field?: unknown; value?: unknown },
    entity: unknown,
  ): boolean {
    const field = readField(predicate, 'field');
    if (field === null) return false;
    if (!Object.prototype.hasOwnProperty.call(predicate, 'value')) return false;
    const actual = readMember(entity, field);
    return areEqual(actual, predicate.value);
  }

  private evaluateFieldCompare(
    predicate: { field?: unknown; op?: unknown; value?: unknown },
    entity: unknown,
  ): boolean {
    const field = readField(predicate, 'field');
    if (field === null) return false;
    if (typeof predicate.op !== 'string') return false;
    if (!Object.prototype.hasOwnProperty.call(predicate, 'value')) return false;
    const actual = readMember(entity, field);
    return compare(actual, predicate.value, predicate.op);
  }

  private evaluateRelationExists(
    predicate: { relation?: unknown; minCount?: unknown },
    entity: unknown,
  ): boolean {
    if (typeof predicate.relation !== 'string') return false;
    const minCount = typeof predicate.minCount === 'number' && Number.isFinite(predicate.minCount)
      ? Math.trunc(predicate.minCount)
      : 1;
    const count = relationCount(entity, predicate.relation);
    if (count === null) return false;
    return count >= minCount;
  }

  private evaluateRelationCountCompare(
    predicate: { relation?: unknown; op?: unknown; value?: unknown },
    entity: unknown,
  ): boolean {
    if (typeof predicate.relation !== 'string') return false;
    if (typeof predicate.op !== 'string') return false;
    if (typeof predicate.value !== 'number' || !Number.isFinite(predicate.value)) return false;
    const count = relationCount(entity, predicate.relation);
    if (count === null) return false;
    return compareNumeric(count, predicate.value, predicate.op);
  }

  private evaluateAll(predicate: { of?: unknown }, entity: unknown): boolean {
    if (!Array.isArray(predicate.of)) return false;
    for (const child of predicate.of) {
      if (!this.evaluate(child, entity)) return false;
    }
    return true;
  }

  private evaluateAny(predicate: { of?: unknown }, entity: unknown): boolean {
    if (!Array.isArray(predicate.of)) return false;
    for (const child of predicate.of) {
      if (this.evaluate(child, entity)) return true;
    }
    return false;
  }

  private evaluateNot(predicate: { of?: unknown }, entity: unknown): boolean {
    if (!isObject(predicate.of)) return false;
    return !this.evaluate(predicate.of, entity);
  }

  private evaluateCustom(predicate: { ref?: unknown }, entity: unknown): boolean {
    if (typeof predicate.ref !== 'string') return false;
    const fn = this.registry.get(predicate.ref);
    if (!fn) return this.warn(`Custom predicate '${predicate.ref}' not registered`);
    try {
      return fn(predicate, entity);
    } catch (err) {
      console.warn('[WORKFLOW-PREDICATE] Custom predicate threw', predicate.ref, err);
      return false;
    }
  }

  private warn(message: string): boolean {
    console.warn(`[WORKFLOW-PREDICATE] ${message}`);
    return false;
  }
}

// ─── Module-level helpers (testable, no allocation per evaluation) ──────

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readField(predicate: { field?: unknown }, key: 'field'): string | null {
  const v = predicate[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Property-path traversal. v1 is single-level (matches C# v1 — no dotted paths).
 * Lookup is exact-match camelCase; we don't auto-fold case beyond what JSON
 * deserialization already does on the wire.
 */
function readMember(entity: unknown, fieldName: string): unknown {
  if (!isObject(entity)) return undefined;
  // Exact match (camelCase).
  if (Object.prototype.hasOwnProperty.call(entity, fieldName)) {
    return entity[fieldName];
  }
  // Tolerate PascalCase if the entity was hand-built that way (rare —
  // mirrors C# evaluator's IgnoreCase reflection lookup so the same
  // fixtures work on both tiers).
  const pascal = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  if (Object.prototype.hasOwnProperty.call(entity, pascal)) {
    return entity[pascal];
  }
  return undefined;
}

function relationCount(entity: unknown, relationName: string): number | null {
  const member = readMember(entity, relationName);
  if (member === null || member === undefined) return 0;
  if (Array.isArray(member)) return member.length;
  // Strings are IEnumerable<char> in .NET — the C# evaluator counts their
  // chars. Mirror that here so cross-tier behavior agrees.
  if (typeof member === 'string') return member.length;
  if (typeof member === 'object') {
    const obj = member as { length?: unknown; size?: unknown };
    if (typeof obj.length === 'number' && Number.isFinite(obj.length)) return obj.length;
    if (typeof obj.size === 'number' && Number.isFinite(obj.size)) return obj.size;
    // Sets / Maps / generic iterables — count by iterating once.
    if (Symbol.iterator in obj) {
      let n = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const item of obj as Iterable<unknown>) n++;
      return n;
    }
  }
  return null;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Strict-ish equality matching the C# `AreEqual` shape:
 *  • null/undefined ↔ json null
 *  • boolean ↔ boolean
 *  • string ↔ string (ordinal)
 *  • numeric ↔ numeric (after coercion via toDouble)
 *  • everything else → false
 */
function areEqual(actual: unknown, expected: unknown): boolean {
  if (actual === null || actual === undefined) return expected === null || expected === undefined;
  if (expected === null || expected === undefined) return false;
  if (typeof expected === 'boolean') {
    return typeof actual === 'boolean' && actual === expected;
  }
  if (typeof expected === 'string') {
    return typeof actual === 'string' && actual === expected;
  }
  if (typeof expected === 'number') {
    const a = toDouble(actual);
    return a !== null && a === expected;
  }
  return false;
}

function compare(actual: unknown, expected: unknown, op: string): boolean {
  if (op === 'eq') return areEqual(actual, expected);
  if (op === 'ne') return !areEqual(actual, expected);
  // gt/lt/gte/lte require numeric coercion on both sides.
  const a = toDouble(actual);
  const b = toDouble(expected);
  if (a === null || b === null) return false;
  return compareNumeric(a, b, op);
}

function compareNumeric(a: number, b: number, op: string): boolean {
  switch (op) {
    case 'eq': return a === b;
    case 'ne': return a !== b;
    case 'gt': return a > b;
    case 'lt': return a < b;
    case 'gte': return a >= b;
    case 'lte': return a <= b;
    default: return false;
  }
}

/**
 * Numeric coercion mirroring C#'s `TryToDouble` — accepts numbers, decimals,
 * booleans (true=1/false=0), and numeric strings parsed in invariant culture.
 * Anything else → null (graceful false in the caller).
 */
function toDouble(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
