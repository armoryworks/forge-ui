import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateLoader, provideTranslateService, TranslateService } from '@ngx-translate/core';
import { TRANSLATE_HTTP_LOADER_CONFIG } from '@ngx-translate/http-loader';

import { environment } from '../../../environments/environment';
import { I18nOverridesService } from '../services/i18n-overrides.service';
import { TerminologyService } from '../services/terminology.service';
import { TerminologyTranslateLoader } from './terminology-translate-loader';
import { TermSetStore } from './term-set.store';

const EN = {
  jobs: { title: 'Jobs', empty: 'No jobs yet', new: 'Create a job' },
  customers: { title: 'Customers' },
  workOrders: { title: 'Work Orders' },
};
const settle = async () => {
  await TestBed.inject(TermSetStore).loadEngine();
  await new Promise(resolve => setTimeout(resolve, 0));
};

const ES = {
  jobs: { title: 'Trabajos', empty: 'Aún no hay trabajos', new: 'Crear un trabajo' },
  customers: { title: 'Clientes' },
  workOrders: { title: 'Órdenes de trabajo' },
};

describe('TerminologyTranslateLoader + TerminologyService', () => {
  let translate: TranslateService;
  let terminology: TerminologyService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: provideTranslateLoader(TerminologyTranslateLoader) }),
        { provide: TRANSLATE_HTTP_LOADER_CONFIG, useValue: { prefix: '/assets/i18n/', suffix: '.json' } },
      ],
    });
    translate = TestBed.inject(TranslateService);
    terminology = TestBed.inject(TerminologyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  const useEnglish = async () => {
    translate.use('en').subscribe();
    http.expectOne('/assets/i18n/en.json').flush(EN);
    await settle();
  };

  const loadTerms = async (entries: { key: string; label: string }[]) => {
    terminology.load();
    http.expectOne(`${environment.apiUrl}/terminology`).flush(entries);
    await settle();
  };

  it('shows the shipped catalog when no terms are set', async () => {
    await useEnglish();
    await loadTerms([]);

    expect(translate.instant('jobs.title')).toBe('Jobs');
  });

  it('renames every label once the term set loads', async () => {
    await useEnglish();
    await loadTerms([{ key: 'entity_job', label: 'Work Order' }, { key: 'entity_customer', label: 'Client' }]);

    expect(translate.instant('jobs.title')).toBe('Work Orders');
    expect(translate.instant('jobs.empty')).toBe('No work orders yet');
    expect(translate.instant('jobs.new')).toBe('Create a work order');
    expect(translate.instant('customers.title')).toBe('Clients');
  });

  it('restores the original wording when the terms are cleared', async () => {
    await useEnglish();
    await loadTerms([{ key: 'entity_job', label: 'Work Order' }]);
    terminology.applyEntries([]);
    await settle();

    expect(translate.instant('jobs.title')).toBe('Jobs');
  });

  it('applies cached terms on the first catalog load, before the API answers', async () => {
    localStorage.setItem('forge.terminology', JSON.stringify({ entity_job: 'Ticket' }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: provideTranslateLoader(TerminologyTranslateLoader) }),
        { provide: TRANSLATE_HTTP_LOADER_CONFIG, useValue: { prefix: '/assets/i18n/', suffix: '.json' } },
      ],
    });
    translate = TestBed.inject(TranslateService);
    http = TestBed.inject(HttpTestingController);

    await useEnglish();

    expect(translate.instant('jobs.title')).toBe('Tickets');
  });

  it('lets a specific i18n label override win over a term rename', async () => {
    await useEnglish();
    const overrides = TestBed.inject(I18nOverridesService);
    overrides.load();
    http.expectOne(`${environment.apiUrl}/i18n/overrides/active`).flush({ en: { 'jobs.empty': 'Queue is clear' } });
    await settle();

    await loadTerms([{ key: 'entity_job', label: 'Ticket' }]);

    expect(translate.instant('jobs.empty')).toBe('Queue is clear');
    expect(translate.instant('jobs.title')).toBe('Tickets');
  });

  it('renames Spanish labels from the Spanish overrides, gated by the English twin', async () => {
    terminology.applyEntries([
      { key: 'entity_job', label: 'Work Order' },
      { key: 'entity_job:es', label: 'Orden de servicio' },
      { key: 'label_jobs:es', label: 'Órdenes de servicio' },
      { key: 'gender_job:es', label: 'f' },
    ]);

    translate.use('es').subscribe();
    http.expectOne('/assets/i18n/es.json').flush(ES);
    http.expectOne('/assets/i18n/en.json').flush(EN);
    await settle();

    expect(translate.instant('jobs.title')).toBe('Órdenes de servicio');
    expect(translate.instant('jobs.new')).toBe('Crear una orden de servicio');
    expect(translate.instant('workOrders.title')).toBe('Órdenes de trabajo');
    expect(translate.instant('customers.title')).toBe('Clientes');
  });

  it('leaves Spanish untouched when only English terms are set', async () => {
    terminology.applyEntries([{ key: 'entity_job', label: 'Work Order' }]);

    translate.use('es').subscribe();
    http.expectOne('/assets/i18n/es.json').flush(ES);
    await settle();

    expect(translate.instant('jobs.title')).toBe('Trabajos');
  });
});
