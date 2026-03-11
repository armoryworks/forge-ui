describe('Backlog', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/backlog');
  });

  it('should display backlog page', () => {
    cy.url().should('include', '/backlog');
  });

  it('should show data table', () => {
    cy.get('app-data-table, app-empty-state, table').should('exist');
  });

  it('should have search and filter inputs', () => {
    cy.get('input, app-input, app-select').should('exist');
  });

  it('should have create job button', () => {
    cy.contains('button', /new|create|add/i).should('exist');
  });
});
