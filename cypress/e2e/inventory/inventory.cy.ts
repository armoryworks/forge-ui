describe('Inventory', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/inventory');
  });

  it('should display inventory page', () => {
    cy.url().should('include', '/inventory');
  });

  it('should show inventory tabs', () => {
    cy.get('.tab, .mat-mdc-tab, [role="tab"]').should('have.length.greaterThan', 0);
  });

  it('should show data table', () => {
    cy.get('app-data-table, table').should('exist');
  });
});
