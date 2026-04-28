/**
 * Phase 4 Phase-F — UI mirror of the server's
 * `DiscoveryQuestionResponseModel`. Self-serve mode returns 27 questions
 * (6 opening + 4 per branch × 3 + 2 override + 6 diagnostic + 1 exit);
 * the wizard filters by branch at render time so the user only sees the
 * 22 that apply to them. Consultant mode (per 4C decision #6) adds 12
 * deepdive questions.
 */

export type DiscoveryQuestionType =
  | 'SingleChoice'
  | 'MultiChoice'
  | 'YesNo'
  | 'Bucketed'
  | 'FreeText'
  | 'YesNoWithDetail';

export type DiscoveryStage =
  | 'Opening'
  | 'BranchA'
  | 'BranchB'
  | 'BranchC'
  | 'Override'
  | 'Diagnostic'
  | 'Exit';

export type DiscoveryCategory =
  | 'Opening'
  | 'BranchSpecific'
  | 'Override'
  | 'Diagnostic'
  | 'Exit'
  | 'ConsultantDeepdive';

export interface DiscoveryChoice {
  value: string;
  label: string;
}

export interface DiscoveryQuestion {
  id: string;
  stage: DiscoveryStage;
  category: DiscoveryCategory;
  type: DiscoveryQuestionType;
  text: string;
  whyAsking: string;
  choices: DiscoveryChoice[] | null;
  branch: string | null;
}

export interface DiscoveryQuestionsResponse {
  totalCount: number;
  selfServeCount: number;
  consultantDeepdiveCount: number;
  questions: DiscoveryQuestion[];
}
