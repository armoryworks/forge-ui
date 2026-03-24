import { TrainingContentType } from './training-content-type.enum';
import { TrainingProgressStatus } from './training-progress-status.enum';

export type VideoGenerationStatus = 'None' | 'Pending' | 'Processing' | 'Done' | 'Failed';

export interface TrainingModuleListItem {
  id: number;
  title: string;
  slug: string;
  summary: string;
  contentType: TrainingContentType;
  coverImageUrl: string | null;
  estimatedMinutes: number;
  tags: string[];
  isPublished: boolean;
  isOnboardingRequired: boolean;
  sortOrder: number;
  myStatus: TrainingProgressStatus | null;
  myQuizScore: number | null;
  myCompletedAt: string | null;
  videoGenerationStatus: VideoGenerationStatus;
  videoMinioKey: string | null;
}

export interface TrainingModuleDetail extends TrainingModuleListItem {
  contentJson: string;
  appRoutes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VideoStatusResponse {
  moduleId: number;
  status: VideoGenerationStatus;
  presignedUrl: string | null;
  errorMessage: string | null;
}
