import { StageRequest } from './stage-request.model';

export interface CreateTrackTypeRequest {
  name: string;
  code: string;
  description: string | null;
  stages: StageRequest[];
}
