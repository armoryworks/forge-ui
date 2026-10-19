import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { TermTextPipe } from './term-text.pipe';
import { TerminologyService } from '../services/terminology.service';
import { TermSetStore } from '../terminology/term-set.store';

describe('TermTextPipe', () => {
  let pipe: TermTextPipe;
  let terminology: TerminologyService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [TermTextPipe, TerminologyService, provideHttpClient(), provideHttpClientTesting()],
    });
    terminology = TestBed.inject(TerminologyService);
    pipe = TestBed.inject(TermTextPipe);
    await TestBed.inject(TermSetStore).loadEngine();
  });

  it('returns server text unchanged when nothing is renamed', () => {
    expect(pipe.transform('Job J-4 created.')).toBe('Job J-4 created.');
  });

  it('renames job wording in stored server text', () => {
    terminology.applyEntries([{ key: 'entity_job', label: 'Ticket' }]);
    expect(pipe.transform('Job J-4 created.')).toBe('Ticket J-4 created.');
    expect(pipe.transform('Work Order Due: J-4 - Bracket run')).toBe('Ticket Due: J-4 - Bracket run');
    expect(pipe.transform('2 jobs created for Sales Order SO-12.')).toBe('2 tickets created for Sales Order SO-12.');
  });

  it('renders empty text as an empty string', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
