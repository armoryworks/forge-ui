describe('Account Pages', () => {
  beforeEach(() => {
    cy.login();
  });

  it('should display profile page', () => {
    cy.visit('/account/profile');
    cy.url().should('include', '/account/profile');
  });

  it('should show profile form fields', () => {
    cy.visit('/account/profile');
    cy.get('app-input, input, app-select').should('exist');
  });

  it('should display pay stubs page', () => {
    cy.visit('/account/pay-stubs');
    cy.url().should('include', '/account/pay-stubs');
  });

  it('should show pay stubs content or empty state', () => {
    cy.visit('/account/pay-stubs');
    cy.get('app-data-table, table, app-empty-state, [class*="pay-stub"]').should('exist');
  });
});
