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
});
