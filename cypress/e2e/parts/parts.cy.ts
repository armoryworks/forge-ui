describe('Parts', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/parts');
  });

  it('should display parts page', () => {
    cy.url().should('include', '/parts');
  });

  it('should show data table', () => {
    cy.get('app-data-table, table').should('exist');
  });

  it('should have search input', () => {
    cy.get('input, app-input').should('exist');
  });

  it('should have create button', () => {
    cy.contains('button', /new|create|add/i).should('exist');
  });
});
