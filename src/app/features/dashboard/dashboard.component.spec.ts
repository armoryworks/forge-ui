import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardComponent } from './dashboard.component';
import { DashboardData } from './models/dashboard-data.model';

describe('DashboardComponent · exportDashboard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes translated headers, quoted labels, local dates and Yes/No', async () => {
    let captured: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { captured = blob as Blob; return 'blob:dash'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const data = {
      kpis: { activeCount: 3, overdueCount: 1, totalHours: '12.5' },
      stages: [{ label: 'Cut, weld', count: 2 }],
      team: [{ name: '=Lee', taskCount: 4 }],
      deadlines: [{ date: '2026-10-30T00:00:00Z', jobNumber: 'J-1', description: 'Say "hi"', isOverdue: true }],
    } as unknown as DashboardData;
    const dashboard = Object.assign(Object.create(DashboardComponent.prototype) as object, {
      data: () => data,
      translate: { instant: (key: string) => key === 'common.yes' ? 'Yes' : key },
    }) as unknown as { exportDashboard(): void };

    dashboard.exportDashboard();

    const bytes = new Uint8Array(await captured!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('dashboard.csv.section,dashboard.csv.field,dashboard.csv.value');
    expect(lines).toContain('"Cut, weld",2');
    expect(lines).toContain('"\'=Lee",4');
    expect(lines.at(-1)).toBe('10/30/2026,J-1,"Say ""hi""",Yes');
  });
});
