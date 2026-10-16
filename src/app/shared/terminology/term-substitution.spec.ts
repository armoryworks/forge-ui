import { createSubstituter, pluralize, resolveTerms, transformCatalog, TranslationTree } from './term-substitution';

const map = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe('term substitution', () => {
  describe('pluralize', () => {
    it('pluralizes the last English word', () => {
      expect(pluralize('Work Order', 'en')).toBe('Work Orders');
      expect(pluralize('Company', 'en')).toBe('Companies');
      expect(pluralize('Batch', 'en')).toBe('Batches');
      expect(pluralize('Day', 'en')).toBe('Days');
    });

    it('pluralizes the first Spanish word', () => {
      expect(pluralize('Orden de trabajo', 'es')).toBe('Ordenes de trabajo');
      expect(pluralize('Socio', 'es')).toBe('Socios');
      expect(pluralize('Cotización', 'es')).toBe('Cotizaciones');
      expect(pluralize('Lápiz', 'es')).toBe('Lápices');
    });
  });

  describe('resolveTerms', () => {
    it('derives the plural from the singular when no plural is given', () => {
      const terms = resolveTerms(map({ entity_job: 'Work Order' }), 'en');
      expect(terms.get('job')).toEqual({ one: 'Work Order', other: 'Work Orders', gender: undefined });
    });

    it('keeps an explicit plural', () => {
      const terms = resolveTerms(map({ entity_job: 'Engagement', label_jobs: 'Tasks' }), 'en');
      expect(terms.get('job')?.other).toBe('Tasks');
    });

    it('reads Spanish keys and gender separately from English', () => {
      const overrides = map({ entity_job: 'Work Order', 'entity_job:es': 'Orden de trabajo', 'gender_job:es': 'f' });
      expect(resolveTerms(overrides, 'es').get('job')).toEqual({ one: 'Orden de trabajo', other: 'Ordenes de trabajo', gender: 'f' });
      expect(resolveTerms(map({ entity_job: 'Work Order' }), 'es').size).toBe(0);
    });

    it('ignores blank labels', () => {
      expect(resolveTerms(map({ entity_job: '  ' }), 'en').size).toBe(0);
    });
  });

  describe('English', () => {
    const sub = createSubstituter(map({ entity_job: 'Work Order', entity_customer: 'Client', entity_part: 'Item' }), 'en');

    it('replaces singular and plural forms', () => {
      expect(sub.substitute('Jobs')).toBe('Work Orders');
      expect(sub.substitute('New Job')).toBe('New Work Order');
      expect(sub.substitute('Customers')).toBe('Clients');
    });

    it('follows the casing of the original word', () => {
      expect(sub.substitute('No jobs found')).toBe('No work orders found');
      expect(sub.substitute('JOB #')).toBe('WORK ORDER #');
      expect(sub.substitute('Select a customer')).toBe('Select a client');
    });

    it('keeps acronyms when lower-casing', () => {
      const rfq = createSubstituter(map({ entity_quote: 'RFQ Response' }), 'en');
      expect(rfq.substitute('Create a quote')).toBe('Create an RFQ response');
    });

    it('fixes a/an before the replacement', () => {
      expect(sub.substitute('Add a part')).toBe('Add an item');
      expect(sub.substitute('A Job was created')).toBe('A Work Order was created');
      const engagement = createSubstituter(map({ entity_job: 'Engagement' }), 'en');
      expect(engagement.substitute('Create a job')).toBe('Create an engagement');
    });

    it('matches whole words only', () => {
      expect(sub.substitute('Jobsite and Customerization')).toBe('Jobsite and Customerization');
    });

    it('leaves protected phrases alone', () => {
      expect(sub.substitute('This is part of the Job')).toBe('This is part of the Work Order');
      expect(sub.substitute('Job Shop preset')).toBe('Job Shop preset');
    });

    it('never touches interpolation placeholders or markup', () => {
      expect(sub.substitute('Job {{job}} for {{customer}}')).toBe('Work Order {{job}} for {{customer}}');
      expect(sub.substitute('<a class="job">Job</a>')).toBe('<a class="job">Work Order</a>');
    });

    it('prefers the longest term match', () => {
      const wc = createSubstituter(map({ entity_work_center: 'Cell', entity_job: 'Ticket' }), 'en');
      expect(wc.substitute('Work Centers and jobs')).toBe('Cells and tickets');
    });

    it('returns the same string when nothing matches', () => {
      const text = 'Nothing to see';
      expect(sub.substitute(text)).toBe(text);
    });
  });

  describe('Spanish', () => {
    const overrides = map({
      'entity_job:es': 'Orden de trabajo',
      'label_jobs:es': 'Órdenes de trabajo',
      'gender_job:es': 'f',
      'entity_customer:es': 'Socio',
    });
    const sub = createSubstituter(overrides, 'es');

    it('replaces Spanish forms and keeps compounds that are other terms', () => {
      expect(sub.substitute('Trabajos')).toBe('Órdenes de trabajo');
      expect(sub.substitute('Centro de trabajo')).toBe('Centro de trabajo');
      expect(sub.substitute('Clientes activos')).toBe('Socios activos');
    });

    it('swaps articles when the gender changes', () => {
      expect(sub.substitute('Crear un trabajo')).toBe('Crear una orden de trabajo');
      expect(sub.substitute('El trabajo fue archivado')).toBe('La orden de trabajo fue archivado');
      expect(sub.substitute('Número del trabajo')).toBe('Número de la orden de trabajo');
      expect(sub.substitute('Los trabajos activos')).toBe('Las órdenes de trabajo activos');
      expect(sub.substitute('¿Cómo creo un nuevo trabajo?')).toBe('¿Cómo creo una nueva orden de trabajo?');
      expect(sub.substitute('Todos los trabajos')).toBe('Todas las órdenes de trabajo');
    });

    it('leaves articles when the gender is unchanged', () => {
      expect(sub.substitute('El cliente')).toBe('El socio');
    });

    it('swaps feminine to masculine', () => {
      const part = createSubstituter(map({ 'entity_part:es': 'Componente', 'gender_part:es': 'm' }), 'es');
      expect(part.substitute('Editar la pieza')).toBe('Editar el componente');
      expect(part.substitute('Precio de la pieza')).toBe('Precio del componente');
    });
  });

  describe('transformCatalog', () => {
    const catalog: TranslationTree = {
      jobs: { title: 'Jobs', empty: 'No jobs yet', list: ['Job one', 'Other'] },
      adminPanels: { terminology: { intro: 'Rename Job or Customer' } },
      count: 3,
    };

    it('rewrites string leaves and keeps the source untouched', () => {
      const sub = createSubstituter(map({ entity_job: 'Ticket' }), 'en');
      const out = transformCatalog(catalog, sub);
      expect(out).toEqual({
        jobs: { title: 'Tickets', empty: 'No tickets yet', list: ['Ticket one', 'Other'] },
        adminPanels: { terminology: { intro: 'Rename Job or Customer' } },
        count: 3,
      });
      expect((catalog['jobs'] as TranslationTree)['title']).toBe('Jobs');
    });

    it('returns the same object when no terms are active', () => {
      const sub = createSubstituter(new Map(), 'en');
      expect(transformCatalog(catalog, sub)).toBe(catalog);
    });

    it('only rewrites a Spanish string when its English twin uses the term', () => {
      const en: TranslationTree = { a: 'Job number', b: 'Work order' };
      const es: TranslationTree = { a: 'Número de trabajo', b: 'Trabajo de taller' };
      const sub = createSubstituter(map({ 'entity_job:es': 'Encargo' }), 'es');
      expect(transformCatalog(es, sub, { catalog: en, lang: 'en' })).toEqual({ a: 'Número de encargo', b: 'Trabajo de taller' });
    });
  });
});
