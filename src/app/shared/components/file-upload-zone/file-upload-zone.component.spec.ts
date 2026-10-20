import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { FileUploadZoneComponent } from './file-upload-zone.component';

/**
 * Uses the signal-input harness (not `componentRef.setInput`) — see
 * `signal-input-harness.ts` for why `input()`-declared inputs can't be set
 * through the fixture under this Vitest setup.
 */
interface Setup {
  /** The protected computed, widened for assertion purposes. */
  acceptedTypes(): string;
  accept: WritableSignal<string>;
}

function setup(accept: string): Setup {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const component = TestBed.runInInjectionContext(() => new FileUploadZoneComponent());
  const inputs = mockSignalInputs(component, {
    entityType: 'leads',
    entityId: 1 as string | number,
    accept,
  });
  const widened = component as unknown as { acceptedTypes: () => string };
  return {
    acceptedTypes: () => widened.acceptedTypes(),
    accept: inputs.accept,
  };
}

describe('FileUploadZoneComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('acceptedTypes', () => {
    it('parses extensions: strips dots, uppercases, joins with commas', () => {
      const s = setup('.pdf,.jpg,.jpeg,.png,.docx');
      expect(s.acceptedTypes()).toBe('PDF, JPG, JPEG, PNG, DOCX');
    });

    it('trims whitespace between tokens and skips empty entries', () => {
      const s = setup(' .pdf , .csv ,, .txt ');
      expect(s.acceptedTypes()).toBe('PDF, CSV, TXT');
    });

    it('renders MIME types by subtype and wildcard MIME types by type', () => {
      const s = setup('application/pdf,image/*');
      expect(s.acceptedTypes()).toBe('PDF, IMAGE');
    });

    it('is empty when accept is empty so the hint line is hidden', () => {
      const s = setup('');
      expect(s.acceptedTypes()).toBe('');
    });

    it('recomputes when the accept input changes', () => {
      const s = setup('');
      expect(s.acceptedTypes()).toBe('');
      s.accept.set('.step,.stl');
      expect(s.acceptedTypes()).toBe('STEP, STL');
    });
  });

  it('clears an earlier rejected-file error when another file is chosen', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const component = TestBed.runInInjectionContext(() => new FileUploadZoneComponent());
    mockSignalInputs(component, { entityType: 'jobs', entityId: 21 as string | number, accept: 'image/*' });
    const zone = component as unknown as {
      uploads: () => { fileName: string; error?: string }[];
      onFileSelected(event: Event): void;
    };
    const choose = (file: File) => zone.onFileSelected({ target: { files: [file] as unknown as FileList, value: '' } } as unknown as Event);

    choose(new File(['x'], 'np.txt', { type: 'text/plain' }));
    expect(zone.uploads().map(u => u.error)).toEqual(['File type not allowed']);

    choose(new File(['png'], 'np-cover.png', { type: 'image/png' }));
    expect(zone.uploads().some(u => u.error)).toBe(false);
    expect(zone.uploads().map(u => u.fileName)).toEqual(['np-cover.png']);
  });
});
