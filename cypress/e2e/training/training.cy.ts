describe('Training', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/training');
  });

  it('should display training page', () => {
    cy.url().should('include', '/training');
  });

  it('should show module cards or empty state', () => {
    cy.get('app-empty-state, [class*="module"], [class*="training"], [class*="card"]').should('exist');
  });

  it('should have tab navigation', () => {
    cy.get('[class*="tab"], mat-tab-group, [role="tablist"]').should('exist');
  });

  it('should have search or filter controls', () => {
    cy.get('input, app-input, app-select').should('exist');
  });
});
