export interface TerminationEffects {
  unassignedJobCount: number;
  stoppedTimer: boolean;
  clockedOut: boolean;
  kioskCredentialsCleared: boolean;
  scanIdentifiersDeactivated: number;
  passkeysRemoved: number;
  apiKeysRevoked: number;
  devicesRevoked: number;
  leaveRequestsCancelled: number;
}
