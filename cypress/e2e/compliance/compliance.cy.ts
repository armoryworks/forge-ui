describe('Compliance Forms', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/account/tax-forms');
  });

  it('should display compliance forms page', () => {
    cy.url().should('include', '/account/tax-forms');
  });

  it('should show form cards or empty state', () => {
    cy.get('[class*="form"], [class*="card"], [class*="compliance"], app-empty-state').should('exist');
  });
});
