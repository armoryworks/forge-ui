import { KioskInspectionTarget } from './kiosk-inspection-target.model';

export type KioskInspectionLookup =
  | { status: 'found'; target: KioskInspectionTarget }
  | { status: 'notFound' }
  | { status: 'otherPart'; partNumber: string | null };
