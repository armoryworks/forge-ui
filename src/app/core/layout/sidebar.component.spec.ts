import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { LayoutService } from '../../shared/services/layout.service';
import { NavTreeService } from '../../shared/services/nav-tree.service';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent mobile flyout', () => {
  let host: HTMLElement;
  let outside: HTMLButtonElement;
  let isMobile: ReturnType<typeof signal<boolean>>;
  let menuOpen: ReturnType<typeof signal<boolean>>;
  let component: SidebarComponent;

  beforeEach(() => {
    host = document.createElement('app-sidebar');
    outside = document.createElement('button');
    document.body.append(host, outside);
    isMobile = signal(true);
    menuOpen = signal(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: new ElementRef(host) },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        {
          provide: LayoutService,
          useValue: {
            isMobile,
            mobileMenuOpen: menuOpen,
            sidebarExpanded: signal(true),
            closeMobileMenu: () => menuOpen.set(false),
          },
        },
        {
          provide: NavTreeService,
          useValue: {
            pinnedTopTree: signal([]),
            mainTree: signal([]),
            bottomTree: signal([]),
            drillTrail: signal([]),
            breadcrumbTrail: signal([]),
          },
        },
      ],
    });
    component = TestBed.runInInjectionContext(() => new SidebarComponent());
  });

  afterEach(() => {
    host.remove();
    outside.remove();
  });

  function click(target: Element): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true });
    target.dispatchEvent(event);
    (component as unknown as { onDocumentClick(e: MouseEvent): void }).onDocumentClick(event);
    return event;
  }

  it('closes when the user clicks outside it, without swallowing the click', () => {
    const reached = vi.fn();
    outside.addEventListener('click', reached);

    const event = click(outside);

    expect(menuOpen()).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it('stays open for clicks inside the flyout', () => {
    const item = document.createElement('a');
    host.appendChild(item);

    click(item);

    expect(menuOpen()).toBe(true);
  });

  it('does nothing on desktop', () => {
    isMobile.set(false);

    click(outside);

    expect(menuOpen()).toBe(true);
  });
});
