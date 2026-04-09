/// <reference types="cypress-axe" />

declare namespace Cypress {
  interface Chainable {
    login(email?: string, password?: string): Chainable<void>;
  }
}

const SEED_PASSWORD = Cypress.env('SEED_USER_PASSWORD') || 'Test1234!';

Cypress.Commands.add('login', (email = 'admin@qbengineer.local', password = SEED_PASSWORD) => {
  cy.session([email, password], () => {
    cy.request({
      method: 'POST',
      url: 'http://localhost:5000/api/v1/auth/login',
      body: { email, password },
    }).then((response) => {
      const { token, refreshToken, user } = response.body;
      window.localStorage.setItem('auth_token', token);
      window.localStorage.setItem('refresh_token', refreshToken);
      window.localStorage.setItem('auth_user', JSON.stringify(user));
    });
  });
});
