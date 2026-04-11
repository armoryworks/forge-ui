describe('Mobile Pages', () => {
  beforeEach(() => {
    cy.login();
  });

  it('should display mobile home page', () => {
    cy.visit('/m/');
    cy.url().should('include', '/m');
  });

  it('should show greeting message', () => {
    cy.visit('/m/');
    cy.get('[class*="greeting"], [class*="welcome"], h1, h2').should('exist');
  });

  it('should show clock status section', () => {
    cy.visit('/m/');
    cy.get('[class*="clock"], [class*="status"], [class*="timer"]').should('exist');
  });

  it('should show active jobs section', () => {
    cy.visit('/m/');
    cy.get('[class*="job"], [class*="task"], [class*="active"], app-empty-state').should('exist');
  });
});
