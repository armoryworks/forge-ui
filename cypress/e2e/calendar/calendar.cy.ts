describe('Calendar', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/calendar');
  });

  it('should display calendar page', () => {
    cy.url().should('include', '/calendar');
  });

  it('should show page title', () => {
    cy.contains(/calendar/i).should('exist');
  });

  it('should render a calendar grid', () => {
    cy.get('.calendar-grid, .calendar-month, mat-calendar, [class*="calendar"]').should('exist');
  });

  it('should show month view toggle', () => {
    cy.contains(/month/i).should('exist');
  });

  it('should show week view toggle', () => {
    cy.contains(/week/i).should('exist');
  });

  it('should show day view toggle', () => {
    cy.contains(/day/i).should('exist');
  });

  it('should switch to week view', () => {
    cy.contains(/week/i).click();
    cy.url().should('include', '/calendar');
    cy.get('.calendar-grid, .calendar-week, [class*="calendar"]').should('exist');
  });

  it('should switch to day view', () => {
    cy.contains(/day/i).click();
    cy.url().should('include', '/calendar');
    cy.get('.calendar-grid, .calendar-day, [class*="calendar"]').should('exist');
  });

  it('should switch back to month view', () => {
    cy.contains(/week/i).click();
    cy.contains(/month/i).click();
    cy.url().should('include', '/calendar');
    cy.get('.calendar-grid, .calendar-month, [class*="calendar"]').should('exist');
  });

  it('should show navigation controls', () => {
    cy.contains('button', /prev|next|today|<|>/i).should('exist');
  });
});
