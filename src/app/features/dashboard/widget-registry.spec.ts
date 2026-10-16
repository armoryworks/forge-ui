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

  it('keeps the planning-cycle widget from the roles the planning-cycles endpoint refuses', () => {
    const widget = WIDGET_REGISTRY.find(w => w.id === 'cycle-progress');
    expect(widget?.roles).toEqual(['Admin', 'Manager', 'PM', 'Engineer', 'ProductionWorker']);
  });

  it('keeps the inventory widget from the roles the inventory endpoints refuse', () => {
    const widget = WIDGET_REGISTRY.find(w => w.id === 'low-stock');
    expect(widget?.roles).toEqual(['Admin', 'Manager', 'OfficeManager', 'Engineer', 'ProductionWorker']);
  });

  it('gives Procurement and the Controller no widget whose endpoint refuses them', () => {
    const rolesOf = (id: string) => WIDGET_REGISTRY.find(w => w.id === id)?.roles;
    for (const id of ['cycle-progress', 'low-stock']) {
      expect(rolesOf(id)).not.toContain('Procurement');
      expect(rolesOf(id)).not.toContain('Controller');
    }
    expect(rolesOf('margin-summary')).not.toContain('Procurement');
  });
});
