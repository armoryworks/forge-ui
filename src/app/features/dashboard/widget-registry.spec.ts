import { WIDGET_REGISTRY } from './widget-registry';

describe('WIDGET_REGISTRY', () => {
  it('gives every widget a title or a title key', () => {
    for (const widget of WIDGET_REGISTRY) {
      expect(widget.titleKey ?? widget.title).toBeTruthy();
    }
  });

  it('titles the jobs-by-stage widget through the dashboard.jobsByStage key', () => {
    const widget = WIDGET_REGISTRY.find(w => w.id === 'jobs-by-stage');
    expect(widget?.titleKey).toBe('dashboard.jobsByStage');
    expect(widget?.title).toBeUndefined();
  });

  it('keeps the margin widget from the roles the margin endpoint refuses', () => {
    const widget = WIDGET_REGISTRY.find(w => w.id === 'margin-summary');
    expect(widget?.roles).toEqual(['Admin', 'Manager', 'Controller', 'OfficeManager', 'PM']);
    expect(widget?.roles).not.toContain('ProductionWorker');
    expect(widget?.roles).not.toContain('Engineer');
  });
});
