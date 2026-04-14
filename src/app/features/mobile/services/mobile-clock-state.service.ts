import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MobileClockStateService {
  readonly isClockedIn = signal(false);
  readonly checkDone = signal(false);

  update(clockedIn: boolean): void {
    this.isClockedIn.set(clockedIn);
    this.checkDone.set(true);
  }
}
