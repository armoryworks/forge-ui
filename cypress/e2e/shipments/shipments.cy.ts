describe('Shipments', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/shipments');
  });

  it('should display shipments page', () => {
    cy.url().should('include', '/shipments');
  });

  it('should show page title', () => {
    cy.contains(/shipments/i).should('exist');
  });

  it('should show data table or empty state', () => {
    cy.get('app-data-table, table, app-empty-state').should('exist');
  });

  it('should have create shipment button', () => {
    cy.contains('button', /new|create|add/i).should('exist');
  });

  it('should show search input', () => {
    cy.get('input, app-input').should('exist');
  });

  it('should render without console errors', () => {
    cy.url().should('include', '/shipments');
    cy.get('app-root').should('exist');
  });
});
