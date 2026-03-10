export interface MyCycleSummaryItem {
  cycleId: number;
  cycleName: string;
  startDate: string;
  endDate: string;
  totalEntries: number;
  completedEntries: number;
  completionRate: number;
  rolledOverCount: number;
}
