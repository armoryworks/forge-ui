export interface MobileAppScreen {
  path: string;
  labelKey: string;
  icon: string;
  capability: string;
  /** Roles the screen's API admits; a screen without roles is open to everyone on the phone. */
  roles?: readonly string[];
}
