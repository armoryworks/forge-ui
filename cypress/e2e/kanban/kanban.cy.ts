describe('Kanban Board', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/kanban');
  });

  it('should display kanban board', () => {
    cy.url().should('include', '/kanban');
  });

  it('should show board columns', () => {
    cy.get('.kanban-column, .board-column, app-kanban-column-header').should('have.length.greaterThan', 0);
  });

  it('should have create job button', () => {
    cy.contains('button', /new|create|add/i).should('exist');
  });
});
