export interface OvertimeRule {
  id: number;
  name: string;
  dailyThresholdHours: number;
  weeklyThresholdHours: number;
  overtimeMultiplier: number;
  doubletimeThresholdDailyHours: number | null;
  doubletimeThresholdWeeklyHours: number | null;
  doubletimeMultiplier: number;
  isDefault: boolean;
  applyDailyBeforeWeekly: boolean;
}

export interface CreateOvertimeRuleRequest {
  name: string;
  dailyThresholdHours: number;
  weeklyThresholdHours: number;
  overtimeMultiplier: number;
  doubletimeThresholdDailyHours?: number;
  doubletimeThresholdWeeklyHours?: number;
  doubletimeMultiplier: number;
  isDefault: boolean;
  applyDailyBeforeWeekly: boolean;
}

export interface OvertimeBreakdown {
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  regularCost: number;
  overtimeCost: number;
  doubletimeCost: number;
  totalCost: number;
  dailyBreakdown: DailyOvertimeDetail[];
}

export interface DailyOvertimeDetail {
  date: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
}
