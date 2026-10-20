import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { NewMessageDialogComponent, NewMessageRecipient } from './new-message-dialog.component';

const USERS: NewMessageRecipient[] = [
  { id: 1, name: 'Me Myself', initials: 'MM', color: '#000' },
  { id: 2, name: 'José García', initials: 'JG', color: '#111' },
  { id: 3, name: 'Ana Ruiz', initials: 'AR', color: '#222' },
];

describe('NewMessageDialogComponent', () => {
  let fixture: ComponentFixture<NewMessageDialogComponent>;
  let httpMock: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  beforeEach(() => {
    close = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NewMessageDialogComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      ],
    });
    fixture = TestBed.createComponent(NewMessageDialogComponent);
    httpMock = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const names = () => Array.from(el.querySelectorAll('[data-testid="new-message-user"]')).map(b => b.querySelector('.new-message__user-name')?.textContent?.trim());

  it('lists everyone except the current user', () => {
    httpMock.expectOne('/api/v1/users').flush(USERS);
    fixture.detectChanges();

    expect(names()).toEqual(['José García', 'Ana Ruiz']);
  });

  it('closes with the picked person', () => {
    httpMock.expectOne('/api/v1/users').flush(USERS);
    fixture.detectChanges();

    (el.querySelector('[data-testid="new-message-user"]') as HTMLButtonElement).click();

    expect(close).toHaveBeenCalledWith(USERS[1]);
  });

  it('shows an unavailable state instead of a list when the people list cannot load', () => {
    httpMock.expectOne('/api/v1/users').flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(names()).toEqual([]);
    expect(el.textContent).toContain('chat.newMessageDialog.unavailable');
  });
});
