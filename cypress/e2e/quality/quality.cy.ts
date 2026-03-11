describe('Quality', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/quality');
  });

  it('should display quality page', () => {
    cy.url().should('include', '/quality');
  });

  it('should show page title', () => {
    cy.contains(/quality/i).should('exist');
  });

  it('should show tabs', () => {
    cy.get('.tab, .mat-mdc-tab, [role="tab"]').should('have.length.greaterThan', 0);
  });

  it('should show QC Inspections tab', () => {
    cy.contains(/inspections/i).should('exist');
  });

  it('should show Lot Tracking tab', () => {
    cy.contains(/lot/i).should('exist');
  });

  it('should switch to Lot Tracking tab', () => {
    cy.contains(/lot/i).click();
    cy.get('app-data-table, table, app-empty-state').should('exist');
  });

  it('should show data table or empty state on default tab', () => {
    cy.get('app-data-table, table, app-empty-state').should('exist');
  });

  it('should have create button on inspections tab', () => {
    cy.contains(/inspections/i).click();
    cy.contains('button', /new|create|add/i).should('exist');
  });
});
