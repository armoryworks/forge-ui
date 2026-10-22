export type StepGatingMode = 'Off' | 'Warn' | 'Block';

export const STEP_GATING_MODES: readonly StepGatingMode[] = ['Off', 'Warn', 'Block'] as const;
