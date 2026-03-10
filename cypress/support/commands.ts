/// <reference types="cypress-axe" />

declare namespace Cypress {
  interface Chainable {
    login(email?: string, password?: string): Chainable<void>;
  }
}

Cypress.Commands.add('login', (email = 'admin@qbengineer.local', password = 'Admin123!') => {
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
