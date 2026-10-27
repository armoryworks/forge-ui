import { EcoPartImpact } from './eco-part-impact.model';

export interface EcoImpact {
  ecoId: number;
  parts: EcoPartImpact[];
}
