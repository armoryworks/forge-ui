describe('Login', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display login form', () => {
    cy.get('form').should('exist');
    cy.get('input[formControlName="email"]').should('be.visible');
    cy.get('input[formControlName="password"]').should('be.visible');
  });

  it('should show error on invalid credentials', () => {
    cy.get('input[formControlName="email"]').type('wrong@email.com');
    cy.get('input[formControlName="password"]').type('wrongpass');
    cy.get('button[type="submit"]').click();
    cy.get('.snackbar--error, .mat-mdc-snack-bar-container').should('exist');
  });

  it('should redirect to dashboard on successful login', () => {
    cy.get('input[formControlName="email"]').type('admin@qbengineer.local');
    cy.get('input[formControlName="password"]').type('Admin123!');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
