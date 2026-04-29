/**
 * Workflow Pattern Phase 4 — Predicate DSL types (twin of the C# evaluator's
 * accepted JSON shape). The evaluator works in plain object form (parsed JSON
 * is `unknown`) but exporting these types keeps callers honest when authoring
 * fixtures or seed data inline.
 *
 * Kept intentionally narrow — operators v1 only:
 *   • fieldPresent | fieldEquals | fieldCompare
 *   • relationExists | relationCountCompare
 *   • all | any | not
 *   • custom (registry hook)
 *
 * Predicates are evaluated against an entity surface — a plain object whose
 * property names are camelCase mirrors of the entity's serialized JSON shape.
 */

export type CompareOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';

export interface FieldPresentNode {
  type: 'fieldPresent';
  field: string;
}

export interface FieldEqualsNode {
  type: 'fieldEquals';
  field: string;
  value: unknown;
}

export interface FieldCompareNode {
  type: 'fieldCompare';
  field: string;
  op: CompareOperator;
  value: unknown;
}

export interface RelationExistsNode {
  type: 'relationExists';
  relation: string;
  /** Defaults to 1 when omitted. */
  minCount?: number;
}

export interface RelationCountCompareNode {
  type: 'relationCountCompare';
  relation: string;
  op: CompareOperator;
  value: number;
}

export interface AllNode {
  type: 'all';
  of: PredicateNode[];
}

export interface AnyNode {
  type: 'any';
  of: PredicateNode[];
}

export interface NotNode {
  type: 'not';
  of: PredicateNode;
}

export interface CustomNode {
  type: 'custom';
  ref: string;
  /** Custom predicates may carry arbitrary additional payload. */
  [key: string]: unknown;
}

export type PredicateNode =
  | FieldPresentNode
  | FieldEqualsNode
  | FieldCompareNode
  | RelationExistsNode
  | RelationCountCompareNode
  | AllNode
  | AnyNode
  | NotNode
  | CustomNode;
