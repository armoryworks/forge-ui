export interface MyCycleSummaryItem {
  cycleId: number;
  cycleName: string;
  startDate: Date;
  endDate: Date;
  totalEntries: number;
  completedEntries: number;
  completionRate: number;
  rolledOverCount: number;
}
