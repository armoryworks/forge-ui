describe('Chat', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/chat');
  });

  it('should display chat page', () => {
    cy.url().should('include', '/chat');
  });

  it('should show conversation list or empty state', () => {
    cy.get('app-empty-state, [class*="conversation"], [class*="chat"]').should('exist');
  });

  it('should have new conversation button', () => {
    cy.contains('button', /new|compose|message/i).should('exist');
  });
});
