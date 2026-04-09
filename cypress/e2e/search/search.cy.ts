describe('Search', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/dashboard');
  });

  it('should show search input in header', () => {
    cy.get('[class*="search"], [aria-label*="search"], [aria-label*="Search"], [placeholder*="Search"]')
      .should('exist');
  });

  it('should show search results on input', () => {
    cy.get('[class*="search"] input, [aria-label*="Search"], [placeholder*="Search"]')
      .first()
      .type('test');
    cy.get('[class*="search-result"], [class*="result"], mat-option, [role="listbox"]')
      .should('exist');
  });
});
