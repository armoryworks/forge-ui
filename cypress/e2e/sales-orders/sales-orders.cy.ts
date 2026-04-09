describe('Sales Orders', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/sales-orders');
  });

  it('should display sales orders page', () => {
    cy.url().should('include', '/sales-orders');
  });

  it('should show data table or empty state', () => {
    cy.get('app-data-table, app-empty-state, table').should('exist');
  });

  it('should have search input', () => {
    cy.get('input, app-input').should('exist');
  });

  it('should have create button', () => {
    cy.contains('button', /new|create|add/i).should('exist');
  });
});
