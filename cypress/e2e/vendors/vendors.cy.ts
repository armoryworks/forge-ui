describe('Vendors', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/vendors');
  });

  it('should display vendors page', () => {
    cy.url().should('include', '/vendors');
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
