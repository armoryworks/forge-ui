import { QcTemplateItem } from './qc-template-item.model';

export interface QcTemplate {
  id: number;
  name: string;
  description: string | null;
  partId: number | null;
  partNumber: string | null;
  isActive: boolean;
  items: QcTemplateItem[];
}
