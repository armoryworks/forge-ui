import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { TerminologyPipe } from './terminology.pipe';
import { TerminologyService } from '../services/terminology.service';

describe('TerminologyPipe', () => {
  let pipe: TerminologyPipe;
  let terminologyService: TerminologyService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        TerminologyPipe,
        TerminologyService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    terminologyService = TestBed.inject(TerminologyService);
    pipe = TestBed.inject(TerminologyPipe);
  });

  it('should create the pipe', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform with configured labels', () => {
    beforeEach(() => {
      terminologyService.applyEntries([
        { key: 'entity_job', label: 'Work Order' },
        { key: 'status_in_production', label: 'Manufacturing' },
        { key: 'action_archive', label: 'Retire' },
      ]);
    });

    it('should resolve a known key to its configured label', () => {
      expect(pipe.transform('entity_job')).toBe('Work Order');
    });

    it('should resolve status key to configured label', () => {
      expect(pipe.transform('status_in_production')).toBe('Manufacturing');
    });

    it('should resolve action key to configured label', () => {
      expect(pipe.transform('action_archive')).toBe('Retire');
    });
  });

  describe('transform with fallback (humanize)', () => {
    it('should strip entity_ prefix and title-case', () => {
      expect(pipe.transform('entity_job')).toBe('Job');
    });

    it('should strip status_ prefix and title-case with spaces', () => {
      expect(pipe.transform('status_in_production')).toBe('In Production');
    });

    it('should strip action_ prefix and title-case', () => {
      expect(pipe.transform('action_archive')).toBe('Archive');
    });

    it('should strip label_ prefix and title-case', () => {
      expect(pipe.transform('label_due_date')).toBe('Due Date');
    });

    it('should title-case unknown prefix keys with underscore-to-space', () => {
      expect(pipe.transform('custom_field_name')).toBe('Custom Field Name');
    });
  });

  describe('transform with overridden labels', () => {
    it('should use an applied override instead of fallback', () => {
      expect(pipe.transform('entity_part')).toBe('Part');

      terminologyService.applyEntries([{ key: 'entity_part', label: 'Component' }]);
      expect(pipe.transform('entity_part')).toBe('Component');
    });

    it('should restore the fallback when an override is cleared', () => {
      terminologyService.applyEntries([{ key: 'entity_job', label: 'Work Order' }]);
      expect(pipe.transform('entity_job')).toBe('Work Order');

      terminologyService.applyEntries([{ key: 'entity_job', label: '' }]);
      expect(pipe.transform('entity_job')).toBe('Job');
    });
  });
});
