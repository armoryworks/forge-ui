describe('Customers', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/customers');
  });

  it('should display customers page', () => {
    cy.url().should('include', '/customers');
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

  it('should navigate to customer detail on row click', () => {
    cy.get('app-data-table').then($table => {
      if ($table.find('tr[class*="data"]').length > 0) {
        cy.get('tr[class*="data"]').first().click();
        cy.url().should('match', /\/customers\/\d+/);
      }
    });
  });
});
