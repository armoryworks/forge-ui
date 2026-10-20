import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { SimilarEntitiesDialogComponent, SimilarEntitiesDialogData } from './similar-entities-dialog.component';

describe('SimilarEntitiesDialogComponent', () => {
  it('keeps the typed name in its own case inside the uppercase create button', async () => {
    const data: SimilarEntitiesDialogData = {
      typedTerm: 'Acme bracket',
      createNewLabel: 'part',
      displayField: 'name',
      secondaryDisplayField: null,
      candidates: [{ id: 1, name: 'Acme Bracket' }],
    };
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { similarEntities: { createAnyway: 'No, create “{{term}}”' } });
    translate.use('en');

    const fixture = TestBed.createComponent(SimilarEntitiesDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const term = document.querySelector('.similar-entities__term');
    expect(term?.textContent).toBe('Acme bracket');
    expect(term?.parentElement?.textContent?.trim()).toBe('No, create “Acme bracket”');
  });
});
