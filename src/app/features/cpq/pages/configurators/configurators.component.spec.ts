import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { BehaviorSubject, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { CpqService } from '../../services/cpq.service';
import { ConfiguratorsComponent } from './configurators.component';

interface PageInternals {
  ngOnInit(): void;
  canAuthor: Signal<boolean>;
  editorOpen: Signal<boolean>;
  editorId: Signal<number | null>;
  configurators: Signal<unknown[]>;
  openEditor(value: number | 'new'): void;
}

function create(roles: string[], query: Record<string, string> = {}): { page: PageInternals; navigate: ReturnType<typeof vi.fn> } {
  const navigate = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CpqService, useValue: { getConfigurators: () => of([{ id: 3, name: 'Bracket builder' }]) } },
      { provide: AuthService, useValue: { hasAnyRole: (list: string[]) => list.some(r => roles.includes(r)) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject(convertToParamMap(query)) } },
      { provide: Router, useValue: { navigate } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new ConfiguratorsComponent()) as unknown as PageInternals;
  page.ngOnInit();
  return { page, navigate };
}

describe('ConfiguratorsComponent', () => {
  it('lists configurators and lets admins and managers author them', () => {
    const { page } = create(['Manager']);
    expect(page.configurators()).toHaveLength(1);
    expect(page.canAuthor()).toBe(true);
    expect(create(['OfficeManager']).page.canAuthor()).toBe(false);
  });

  it('opens the configurator named in the URL', () => {
    expect(create(['Admin'], { configurator: '3' }).page.editorId()).toBe(3);
    const fresh = create(['Admin'], { configurator: 'new' }).page;
    expect(fresh.editorOpen()).toBe(true);
    expect(fresh.editorId()).toBeNull();
    expect(create(['Admin']).page.editorOpen()).toBe(false);
  });

  it('puts the opened configurator in the URL', () => {
    const { page, navigate } = create(['Admin']);
    page.openEditor('new');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { configurator: 'new' } }));
  });
});
