import { describe, it, expect } from 'vitest';

import { buildExportRows, exportCsvRows, flattenCatalog, nestCatalog, parseTranslationFile, planImport } from './translation-transfer.utils';

const shipped = { 'common.save': 'Guardar', 'common.cancel': 'Cancelar', 'customers.title': 'Clientes' };

describe('translation transfer', () => {
  it('flattens and re-nests the catalog shape', () => {
    const flat = flattenCatalog({ common: { save: 'Guardar', list: ['x'] }, top: 'Arriba' });

    expect(flat).toEqual({ 'common.save': 'Guardar', top: 'Arriba' });
    expect(nestCatalog(flat)).toEqual({ common: { save: 'Guardar' }, top: 'Arriba' });
  });

  it('exports every shipped key with the override winning and flagged', () => {
    const rows = buildExportRows(shipped, { 'customers.title': 'Cuentas', 'gone.key': 'x', 'common.save': 'Guardar' });

    expect(rows).toEqual([
      { key: 'common.cancel', value: 'Cancelar', shippedValue: 'Cancelar', overridden: false },
      { key: 'common.save', value: 'Guardar', shippedValue: 'Guardar', overridden: false },
      { key: 'customers.title', value: 'Cuentas', shippedValue: 'Clientes', overridden: true },
    ]);
    expect(exportCsvRows(rows, ['key', 'value', 'shipped', 'overridden'])[3]).toEqual(['customers.title', 'Cuentas', 'Clientes', 'yes']);
  });

  it('reads nested JSON, flat JSON and the exported CSV', () => {
    expect(parseTranslationFile('{"common":{"save":"Salvar"}}', 'es.json')).toEqual({ 'common.save': 'Salvar' });
    expect(parseTranslationFile('{"common.save":"Salvar"}', 'flat.json')).toEqual({ 'common.save': 'Salvar' });
    expect(parseTranslationFile('\uFEFFkey,value,shipped,overridden\ncommon.save,"Salvar, ya",Guardar,\n', 'es.csv'))
      .toEqual({ 'common.save': 'Salvar, ya' });
    expect(parseTranslationFile('a,b\n1,2', 'x.csv')).toBeNull();
    expect(parseTranslationFile('{not json', 'x.json')).toBeNull();
  });

  it('plans only real changes, reports unknown keys and marks reverts to the shipped text', () => {
    const plan = planImport(
      { 'common.save': 'Salvar', 'common.cancel': 'Cancelar', 'customers.title': 'Clientes', 'nope.key': 'x', 'common.blank': '' },
      { ...shipped, 'common.blank': 'Vacío' },
      { 'customers.title': 'Cuentas' });

    expect(plan.unknownKeys).toEqual(['nope.key']);
    expect(plan.unchangedCount).toBe(2);
    expect(plan.changes).toEqual([
      { key: 'common.save', currentValue: 'Guardar', newValue: 'Salvar', shippedValue: 'Guardar', revertsToShipped: false },
      { key: 'customers.title', currentValue: 'Cuentas', newValue: 'Clientes', shippedValue: 'Clientes', revertsToShipped: true },
    ]);
  });
});
