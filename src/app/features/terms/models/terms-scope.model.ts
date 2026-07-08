/**
 * The three scopes a terms & conditions document can attach to. Company terms
 * apply to every quote; Customer/Part terms layer on for the relevant lines.
 * Scope is fixed at create time and immutable thereafter.
 */
export type TermsScope = 'Company' | 'Customer' | 'Part';
