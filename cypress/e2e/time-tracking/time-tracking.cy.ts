describe('Time Tracking', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/time-tracking');
  });

  it('should display time tracking page', () => {
    cy.url().should('include', '/time-tracking');
  });

  it('should show timer or entry section', () => {
    cy.get('app-data-table, app-empty-state, table, .timer, .time-entry').should('exist');
  });

  it('should have create entry button', () => {
    cy.contains('button', /new|create|add|start/i).should('exist');
  });

  it('should show entries table', () => {
    cy.get('app-data-table, app-empty-state, table').should('exist');
  });

  it('should have date filter', () => {
    cy.get('app-datepicker, app-date-range-picker, app-select, mat-select, input[type="date"]').should('exist');
  });
});
