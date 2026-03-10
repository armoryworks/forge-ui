describe('Dashboard', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/dashboard');
  });

  it('should display dashboard page', () => {
    cy.url().should('include', '/dashboard');
  });

  it('should show dashboard widgets', () => {
    cy.get('app-dashboard-widget, .dashboard-widget, .grid-stack-item').should('have.length.greaterThan', 0);
  });

  it('should have navigation sidebar', () => {
    cy.get('app-sidebar, nav').should('exist');
  });
});
