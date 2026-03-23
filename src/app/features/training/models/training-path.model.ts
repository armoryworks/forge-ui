import { TrainingContentType } from './training-content-type.enum';
import { TrainingProgressStatus } from './training-progress-status.enum';

export interface TrainingPathModule {
  moduleId: number;
  title: string;
  contentType: TrainingContentType;
  estimatedMinutes: number;
  position: number;
  isRequired: boolean;
  myStatus: TrainingProgressStatus | null;
}

export interface TrainingPath {
  id: number;
  title: string;
  slug: string;
  description: string;
  icon: string;
  isAutoAssigned: boolean;
  isActive: boolean;
  modules: TrainingPathModule[];
}
