describe('Expenses', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/expenses');
  });

  it('should display expenses page', () => {
    cy.url().should('include', '/expenses');
  });

  it('should show data table or empty state', () => {
    cy.get('app-data-table, table, app-empty-state').should('exist');
  });

  it('should have create expense button', () => {
    cy.contains('button', /new|create|add|submit/i).should('exist');
  });
});
