import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SequencesService } from '../../services/sequences.service';
import { SequenceDefinitionEditorComponent } from './sequence-definition-editor.component';

describe('SequenceDefinitionEditorComponent · bad links', () => {
  function create(id: string, getDefinition: () => unknown) {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: SequencesService, useValue: { getDefinition: vi.fn(getDefinition) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new SequenceDefinitionEditorComponent());
    return {
      view: component as unknown as { loadError(): unknown; loading(): boolean },
      service: TestBed.inject(SequencesService),
    };
  }

  it('shows not-found for a non-numeric id without calling the API', () => {
    const { view, service } = create('abc', () => of({}));
    expect((view.loadError() as HttpErrorResponse).status).toBe(404);
    expect(service.getDefinition).not.toHaveBeenCalled();
  });

  it('shows the API error instead of an empty editable form when the definition is missing', () => {
    const missing = new HttpErrorResponse({ status: 404 });
    const { view } = create('999999', () => throwError(() => missing));
    expect(view.loadError()).toBe(missing);
    expect(view.loading()).toBe(false);
  });
});
