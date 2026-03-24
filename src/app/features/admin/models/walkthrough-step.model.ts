export interface WalkthroughPopover {
  title: string;
  description: string;
  side: 'top' | 'bottom' | 'left' | 'right';
  align: 'start' | 'center' | 'end';
}

export interface WalkthroughStep {
  element: string | null;
  popover: WalkthroughPopover;
}

export interface GenerateWalkthroughResponse {
  moduleId: number;
  stepCount: number;
  steps: WalkthroughStep[];
  contentJson: string;
}
