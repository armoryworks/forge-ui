import { StageRequest } from './stage-request.model';

export interface UpdateTrackTypeRequest {
  name: string;
  code: string;
  description: string | null;
  stages: StageRequest[];
}
