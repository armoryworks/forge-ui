export interface TrainingUserRow {
  id: number;
  name: string;
  role: string;
  toursCompleted: number;
  totalTours: number;
  lastTour: string | null;
  completionPct: number;
}
