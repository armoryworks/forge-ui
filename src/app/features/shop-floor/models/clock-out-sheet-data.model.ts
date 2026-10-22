import { KioskRunningTimer } from './kiosk-running-timer.model';

export interface ClockOutSheetData {
  workerName: string;
  timers: KioskRunningTimer[];
}
