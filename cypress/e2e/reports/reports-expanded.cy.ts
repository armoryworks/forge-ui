describe('Reports (Expanded)', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/reports');
  });

  it('should display reports page', () => {
    cy.url().should('include', '/reports');
  });

  it('should show page title', () => {
    cy.contains(/reports/i).should('exist');
  });

  it('should show report type selector', () => {
    cy.get('app-select, mat-select, select').should('exist');
  });

  it('should render a report content area', () => {
    cy.get('app-data-table, table, canvas, app-empty-state, .report-content').should('exist');
  });

  it('should be able to switch to Job Margin report', () => {
    cy.get('app-select, mat-select').first().click();
    cy.contains(/margin/i).click();
    cy.get('app-data-table, table, canvas, app-empty-state').should('exist');
  });

  it('should be able to switch to Employee Productivity report', () => {
    cy.get('app-select, mat-select').first().click();
    cy.contains(/productivity/i).click();
    cy.get('app-data-table, table, canvas, app-empty-state').should('exist');
  });

  it('should be able to switch to Inventory Levels report', () => {
    cy.get('app-select, mat-select').first().click();
    cy.contains(/inventory/i).click();
    cy.get('app-data-table, table, canvas, app-empty-state').should('exist');
  });

  it('should show date range filter', () => {
    cy.get('app-date-range-picker, app-datepicker, input[type="date"]').should('exist');
  });
});
