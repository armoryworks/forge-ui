export interface WalkthroughPopover {
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export interface WalkthroughStep {
  element?: string;
  popover: WalkthroughPopover;
}

export interface WalkthroughContent {
  appRoute: string;
  startButtonLabel: string;
  steps: WalkthroughStep[];
}
