import { KioskRunningTimer } from './kiosk-running-timer.model';

export interface ClockOutSheetLine {
  timer: KioskRunningTimer;
  goodQuantity: number | null;
  scrapQuantity: number | null;
}
