describe('Admin', () => {
  beforeEach(() => {
    cy.login(); // admin user
    cy.visit('/admin');
  });

  it('should display admin page', () => {
    cy.url().should('include', '/admin');
  });

  it('should show admin tabs or sections', () => {
    cy.get('.tab, .mat-mdc-tab, [role="tab"]').should('have.length.greaterThan', 0);
  });

  it('should show user management', () => {
    cy.get('app-data-table, table').should('exist');
  });
});
