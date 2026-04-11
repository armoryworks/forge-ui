describe('Events Admin', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/admin/events');
  });

  it('should display events page', () => {
    cy.url().should('include', '/admin/events');
  });

  it('should show events table or empty state', () => {
    cy.get('app-data-table, table, app-empty-state').should('exist');
  });

  it('should have create button', () => {
    cy.contains('button', /new|create|add/i).should('exist');
  });
});
