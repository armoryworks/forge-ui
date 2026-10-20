import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EventsPanelComponent } from './events-panel.component';
import { EventsService } from '../../../events/services/events.service';
import { CalendarService } from '../../../calendar/services/calendar.service';
import { AdminService } from '../../services/admin.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AppEvent } from '../../../events/models/event.model';
import { ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

describe('EventsPanelComponent', () => {
  let dialogOpen: ReturnType<typeof vi.fn>;
  let deleteEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(false) }));
    deleteEvent = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      imports: [EventsPanelComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: EventsService, useValue: { deleteEvent } },
        { provide: CalendarService, useValue: {} },
        { provide: AdminService, useValue: {} },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
      ],
    });
  });

  it('asks to cancel an event with a translated keep-event dismiss label instead of a second Cancel', () => {
    const fixture = TestBed.createComponent(EventsPanelComponent);
    const component = fixture.componentInstance as unknown as { cancelEvent(e: AppEvent): void };

    component.cancelEvent({ id: 7, title: 'Safety stand-down' } as AppEvent);

    const data = dialogOpen.mock.calls[0][1].data as ConfirmDialogData;
    expect(data.title).toBe('adminPanels.events.cancelDialog.title');
    expect(data.confirmLabel).toBe('adminPanels.events.cancelDialog.confirm');
    expect(data.cancelLabel).toBe('adminPanels.events.cancelDialog.keep');
    expect(deleteEvent).not.toHaveBeenCalled();
  });
});
