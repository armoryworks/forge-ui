export interface JobLink {
  id: number;
  sourceJobId: number;
  targetJobId: number;
  linkType: string;
  linkedJobId: number;
  linkedJobNumber: string;
  linkedJobTitle: string;
  linkedJobStageName: string;
  linkedJobStageColor: string;
  createdAt: string;
}
