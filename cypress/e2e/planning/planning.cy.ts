describe('Planning', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/planning');
  });

  it('should display planning page', () => {
    cy.url().should('include', '/planning');
  });

  it('should show backlog panel', () => {
    cy.get('.backlog, [class*="backlog"], app-data-table, app-list-panel').should('exist');
  });

  it('should show cycle panel or empty state', () => {
    cy.get('.cycle, [class*="cycle"], app-empty-state, app-data-table').should('exist');
  });

  it('should have new cycle button', () => {
    cy.contains('button', /new|create|add/i).should('exist');
  });

  it('should have cycle selector', () => {
    cy.get('app-select, mat-select, .cycle-selector, [class*="cycle"]').should('exist');
  });
});
