describe('Accessibility', () => {
  beforeEach(() => {
    cy.login();
  });

  it('dashboard should have no critical accessibility violations', () => {
    cy.visit('/dashboard');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('kanban board should have no critical accessibility violations', () => {
    cy.visit('/kanban');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('login page should have no critical accessibility violations', () => {
    cy.clearAllSessionStorage();
    cy.clearAllLocalStorage();
    cy.visit('/login');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('parts page should have no critical accessibility violations', () => {
    cy.visit('/parts');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('inventory page should have no critical accessibility violations', () => {
    cy.visit('/inventory');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('admin page should have no critical accessibility violations', () => {
    cy.visit('/admin');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('reports page should have no critical accessibility violations', () => {
    cy.visit('/reports');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('expenses page should have no critical accessibility violations', () => {
    cy.visit('/expenses');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('leads page should have no critical accessibility violations', () => {
    cy.visit('/leads');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });

  it('time-tracking page should have no critical accessibility violations', () => {
    cy.visit('/time-tracking');
    cy.injectAxe();
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious'],
    });
  });
});
