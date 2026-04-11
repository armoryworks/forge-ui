describe('Shop Floor Display', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/display/shop-floor');
  });

  it('should display shop floor page', () => {
    cy.url().should('include', '/display/shop-floor');
  });

  it('should show header elements', () => {
    cy.get('[class*="header"], [class*="toolbar"], [class*="clock"]').should('exist');
  });

  it('should show worker cards section', () => {
    cy.get('[class*="worker"], [class*="card"], [class*="grid"], app-quick-action-panel').should('exist');
  });

  it('should show job queue or empty state', () => {
    cy.get('[class*="job"], [class*="queue"], app-empty-state').should('exist');
  });
});
