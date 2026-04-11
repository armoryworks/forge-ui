describe('Onboarding', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/account/onboarding');
  });

  it('should display onboarding page', () => {
    cy.url().should('include', '/account/onboarding');
  });

  it('should show onboarding wizard or stepper', () => {
    cy.get('mat-stepper, [class*="stepper"], [class*="wizard"], [class*="onboarding"], [class*="step"]').should('exist');
  });
});
