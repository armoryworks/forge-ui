describe('Purchase Orders', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/purchase-orders');
  });

  it('should display purchase orders page', () => {
    cy.url().should('include', '/purchase-orders');
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

  it('should have status filter', () => {
    cy.get('app-select, mat-select').should('exist');
  });
});
