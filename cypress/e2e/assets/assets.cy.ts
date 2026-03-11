describe('Assets', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/assets');
  });

  it('should display assets page', () => {
    cy.url().should('include', '/assets');
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

  it('should show asset tabs', () => {
    cy.get('.tab, [role="tab"], mat-tab, .tab-bar').should('exist');
  });
});
