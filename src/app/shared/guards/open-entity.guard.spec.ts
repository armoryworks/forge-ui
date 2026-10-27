import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { openEntityGuard } from './open-entity.guard';

function open(type: string, id: string): string {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const route = { paramMap: convertToParamMap({ type, id }) } as ActivatedRouteSnapshot;
  const result = TestBed.runInInjectionContext(() => openEntityGuard(route, {} as RouterStateSnapshot)) as UrlTree;
  return TestBed.inject(Router).serializeUrl(result);
}

describe('openEntityGuard', () => {
  it('sends an emailed job link to the job on the board', () => {
    expect(open('Job', '7')).toBe('/board?job=7');
  });

  it('sends a chat mention to chat', () => {
    expect(open('ChatRoom', '3')).toBe('/chat');
  });

  it('falls back to the notifications list for an unknown record or a bad id', () => {
    expect(open('Banana', '7')).toBe('/notifications');
    expect(open('Job', 'x')).toBe('/notifications');
  });
});
