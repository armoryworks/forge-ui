import { TrainingPathDialogModuleOption } from './training-path-dialog-module-option.model';

export interface TrainingPathDialogData {
  path: {
    id: number;
    title: string;
    slug?: string;
    description?: string;
    icon: string;
    isAutoAssigned: boolean;
    isActive: boolean;
    moduleIds?: number[];
  } | null;
  availableModules: TrainingPathDialogModuleOption[];
}
