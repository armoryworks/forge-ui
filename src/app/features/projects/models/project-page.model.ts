import { Project } from './project.model';

export interface ProjectPage {
  data: Project[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
