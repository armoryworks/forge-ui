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
});
