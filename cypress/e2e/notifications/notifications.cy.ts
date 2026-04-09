describe('Notifications', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/dashboard');
  });

  it('should show notification bell in header', () => {
    cy.get('[class*="notification"], [aria-label*="notification"], [aria-label*="Notification"]')
      .should('exist');
  });

  it('should open notification panel on bell click', () => {
    cy.get('[class*="notification"], [aria-label*="notification"], [aria-label*="Notification"]')
      .first()
      .click();
    cy.get('app-notification-panel, [class*="notification-panel"]').should('exist');
  });
});
