import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CalendarComponent } from '../calendar/calendar.component';

/**
 * Compliance module home — a thin smart wrapper that hosts the shared calendar
 * scoped to `module:compliance`, giving it the "Compliance" title in the
 * calendar's own single page-header (no stacked headers). The scope drives the
 * calendar to default its visible layers to every super-group the user can see
 * (surfacing the regulatory / compliance buckets, which are hidden by default
 * in the master calendar) and namespaces saved views to this module. No
 * business logic here.
 */
@Component({
  selector: 'app-compliance',
  standalone: true,
  imports: [CalendarComponent],
  templateUrl: './compliance.component.html',
  styleUrl: './compliance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceComponent {}
