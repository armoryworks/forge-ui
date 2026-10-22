import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { ClockEventTypeService, ClockEventTypeDef } from './clock-event-type.service';

const EN = {
  clockStatus: {
    in: 'Currently Working', inShort: 'IN', out: 'Clocked Out', outShort: 'OUT',
    onBreak: 'On Break', onBreakShort: 'BREAK', onLunch: 'On Lunch', onLunchShort: 'LUNCH', unknown: 'Unknown',
  },
  clockActions: { ClockOut: 'Clock Out', BreakStart: 'Start Break' },
};
const ES = {
  clockStatus: { in: 'Trabajando', inShort: 'DENTRO', out: 'Salida registrada', outShort: 'FUERA' },
  clockActions: { ClockOut: 'Marcar salida', BreakStart: 'Iniciar descanso' },
};

describe('ClockEventTypeService', () => {
  let service: ClockEventTypeService;
  let httpMock: HttpTestingController;
  let translate: TranslateService;

  const mockReferenceData = [
    {
      id: 1,
      code: 'ClockIn',
      label: 'Clock In',
      metadata: JSON.stringify({
        statusMapping: 'In',
        oppositeCode: 'ClockOut',
        category: 'work',
        countsAsActive: true,
        isMismatchable: true,
        icon: 'login',
        color: '#22c55e',
      }),
    },
    {
      id: 2,
      code: 'ClockOut',
      label: 'Clock Out',
      metadata: JSON.stringify({
        statusMapping: 'Out',
        oppositeCode: 'ClockIn',
        category: 'work',
        countsAsActive: false,
        isMismatchable: true,
        icon: 'logout',
        color: '#ef4444',
      }),
    },
    {
      id: 3,
      code: 'BreakStart',
      label: 'Start Break',
      metadata: JSON.stringify({
        statusMapping: 'OnBreak',
        oppositeCode: 'BreakEnd',
        category: 'break',
        countsAsActive: false,
        isMismatchable: false,
        icon: 'coffee',
        color: '#f59e0b',
      }),
    },
    {
      id: 4,
      code: 'BreakEnd',
      label: 'End Break',
      metadata: JSON.stringify({
        statusMapping: 'In',
        oppositeCode: 'BreakStart',
        category: 'break',
        countsAsActive: true,
        isMismatchable: false,
        icon: 'play_arrow',
        color: '#22c55e',
      }),
    },
    {
      id: 5,
      code: 'LunchStart',
      label: 'Start Lunch',
      metadata: JSON.stringify({
        statusMapping: 'OnLunch',
        oppositeCode: 'LunchEnd',
        category: 'lunch',
        countsAsActive: false,
        isMismatchable: false,
        icon: 'restaurant',
        color: '#f59e0b',
      }),
    },
    {
      id: 6,
      code: 'LunchEnd',
      label: 'End Lunch',
      metadata: JSON.stringify({
        statusMapping: 'In',
        oppositeCode: 'LunchStart',
        category: 'lunch',
        countsAsActive: true,
        isMismatchable: false,
        icon: 'play_arrow',
        color: '#22c55e',
      }),
    },
  ];

  function loadDefinitions(): void {
    service.load();
    const req = httpMock.expectOne('/api/v1/reference-data/clock_event_type');
    req.flush({ data: mockReferenceData });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ClockEventTypeService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService(),
      ],
    });

    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', EN);
    translate.setTranslation('es', ES);
    translate.use('en');
    service = TestBed.inject(ClockEventTypeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── load ──

  it('shows statuses and actions in Spanish after the language switches', () => {
    loadDefinitions();

    translate.use('es');

    expect(service.getLabel('In')).toBe('Trabajando');
    expect(service.getShortLabel('Out')).toBe('FUERA');
    const labels = service.getAvailableActions('In').map((a) => a.label);
    expect(labels).toContain('Marcar salida');
    expect(labels).toContain('Iniciar descanso');
    expect(labels).toContain('Start Lunch');
  });

  it('should load definitions from API on init', () => {
    loadDefinitions();

    expect(service.definitions().length).toBe(6);
    expect(service.definitions()[0].code).toBe('ClockIn');
    expect(service.definitions()[0].statusMapping).toBe('In');
    expect(service.definitions()[1].code).toBe('ClockOut');
  });

  it('should only load once when called multiple times', () => {
    loadDefinitions();

    service.load();
    httpMock.expectNone('/api/v1/reference-data/clock_event_type');
  });

  it('should allow retry after load error', () => {
    service.load();
    const req = httpMock.expectOne('/api/v1/reference-data/clock_event_type');
    req.error(new ProgressEvent('error'));

    service.load();
    const retryReq = httpMock.expectOne('/api/v1/reference-data/clock_event_type');
    retryReq.flush({ data: mockReferenceData });

    expect(service.definitions().length).toBe(6);
  });

  // ── getStatusInfo ──

  it('should return correct status info for "In" status', () => {
    const info = service.getStatusInfo('In');

    expect(info.label).toBe('Currently Working');
    expect(info.shortLabel).toBe('IN');
    expect(info.cssClass).toBe('in');
  });

  it('should return correct status info for "Out" status', () => {
    const info = service.getStatusInfo('Out');

    expect(info.label).toBe('Clocked Out');
    expect(info.shortLabel).toBe('OUT');
    expect(info.cssClass).toBe('out');
  });

  it('should return correct status info for "OnBreak" status', () => {
    const info = service.getStatusInfo('OnBreak');

    expect(info.label).toBe('On Break');
    expect(info.shortLabel).toBe('BREAK');
    expect(info.cssClass).toBe('break');
  });

  it('should return correct status info for "OnLunch" status', () => {
    const info = service.getStatusInfo('OnLunch');

    expect(info.label).toBe('On Lunch');
    expect(info.shortLabel).toBe('LUNCH');
    expect(info.cssClass).toBe('break');
  });

  it('should return Out status info for null/undefined', () => {
    expect(service.getStatusInfo(null).label).toBe('Clocked Out');
    expect(service.getStatusInfo(undefined).label).toBe('Clocked Out');
  });

  it('should return fallback for unknown status without definitions', () => {
    const info = service.getStatusInfo('CustomStatus');

    expect(info.label).toBe('Unknown');
    expect(info.shortLabel).toBe('?');
    expect(info.cssClass).toBe('out');
  });

  // ── getStatusCssClass ──

  it('should return correct CSS class for status', () => {
    expect(service.getStatusCssClass('In')).toBe('in');
    expect(service.getStatusCssClass('Out')).toBe('out');
    expect(service.getStatusCssClass('OnBreak')).toBe('break');
    expect(service.getStatusCssClass('OnLunch')).toBe('break');
    expect(service.getStatusCssClass(null)).toBe('out');
  });

  // ── isWorking ──

  it('should identify working status correctly', () => {
    expect(service.isWorking('In')).toBe(true);
    expect(service.isWorking('Out')).toBe(false);
    expect(service.isWorking('OnBreak')).toBe(false);
    expect(service.isWorking(null)).toBe(false);
  });

  // ── isOnBreakOrLunch ──

  it('should identify break/lunch status correctly', () => {
    expect(service.isOnBreakOrLunch('OnBreak')).toBe(true);
    expect(service.isOnBreakOrLunch('OnLunch')).toBe(true);
    expect(service.isOnBreakOrLunch('In')).toBe(false);
    expect(service.isOnBreakOrLunch('Out')).toBe(false);
    expect(service.isOnBreakOrLunch(null)).toBe(false);
  });

  // ── isActive ──

  it('should identify active status correctly', () => {
    expect(service.isActive('In')).toBe(true);
    expect(service.isActive('OnBreak')).toBe(true);
    expect(service.isActive('Out')).toBe(false);
    expect(service.isActive(null)).toBe(false);
  });

  // ── isClockedOut ──

  it('should identify clocked out status correctly', () => {
    expect(service.isClockedOut('Out')).toBe(true);
    expect(service.isClockedOut(null)).toBe(true);
    expect(service.isClockedOut(undefined)).toBe(true);
    expect(service.isClockedOut('In')).toBe(false);
  });

  // ── getAvailableActions ──

  it('should return available actions based on current status', () => {
    loadDefinitions();

    // When clocked out, ClockIn should be available (opposite ClockOut has statusMapping Out = matches)
    const outActions = service.getAvailableActions('Out');
    const outCodes = outActions.map((a) => a.code);
    expect(outCodes).toContain('ClockIn');
    expect(outCodes).not.toContain('ClockOut');

    // When clocked in, ClockOut + BreakStart + LunchStart should be available
    const inActions = service.getAvailableActions('In');
    const inCodes = inActions.map((a) => a.code);
    expect(inCodes).toContain('ClockOut');
    expect(inCodes).toContain('BreakStart');
    expect(inCodes).toContain('LunchStart');
    expect(inCodes).not.toContain('ClockIn');

    // When on break, BreakEnd + ClockOut should be available
    const breakActions = service.getAvailableActions('OnBreak');
    const breakCodes = breakActions.map((a) => a.code);
    expect(breakCodes).toContain('BreakEnd');
    expect(breakCodes).toContain('ClockOut');
  });

  it('should return empty actions when definitions not loaded', () => {
    const actions = service.getAvailableActions('In');

    expect(actions).toEqual([]);
  });

  it('should treat null status as Out for available actions', () => {
    loadDefinitions();

    const actions = service.getAvailableActions(null);
    const codes = actions.map((a) => a.code);
    expect(codes).toContain('ClockIn');
    expect(codes).not.toContain('ClockOut');
  });

  // ── getLabel ──

  it('getLabel should return label for known status', () => {
    expect(service.getLabel('In')).toBe('Currently Working');
    expect(service.getLabel('Out')).toBe('Clocked Out');
    expect(service.getLabel('OnBreak')).toBe('On Break');
    expect(service.getLabel('OnLunch')).toBe('On Lunch');
  });

  it('getLabel should return fallback for unknown status', () => {
    expect(service.getLabel('CustomUnknown')).toBe('Unknown');
  });
});
