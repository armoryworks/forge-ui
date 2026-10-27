import { ProjectStatus } from './project-status.model';

export interface UpdateProjectRequest {
  status?: ProjectStatus;
  percentComplete?: number | null;
}
