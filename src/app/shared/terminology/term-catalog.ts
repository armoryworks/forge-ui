export type TermGender = 'm' | 'f';

export interface TermSourceForm {
  text: string;
  plural: boolean;
  gender?: TermGender;
}

export interface TermLocaleForms {
  forms: TermSourceForm[];
  protect?: string[];
}

export interface TermDefinition {
  id: string;
  pluralId: string;
  locales: Record<string, TermLocaleForms>;
}

export const TERM_LANGUAGES = ['en', 'es'] as const;

export const TERM_EXCLUDED_KEY_PREFIXES = ['adminPanels.terminology.'];

const en = (one: string, other: string, protect?: string[]): TermLocaleForms => ({
  forms: [{ text: one, plural: false }, { text: other, plural: true }],
  ...(protect ? { protect } : {}),
});

const es = (one: string, other: string, gender: TermGender, protect?: string[]): TermLocaleForms => ({
  forms: [{ text: one, plural: false, gender }, { text: other, plural: true, gender }],
  ...(protect ? { protect } : {}),
});

const ES_TRABAJO_COMPOUNDS = [
  'orden de trabajo', 'órdenes de trabajo', 'orden(es) de trabajo', 'suborden de trabajo', 'subórdenes de trabajo',
  'centro de trabajo', 'centros de trabajo', 'flujo de trabajo', 'flujos de trabajo', 'cola de trabajo',
  'autorización de trabajo', 'ubicación de trabajo', 'carga de trabajo', 'espacio de trabajo', 'área de trabajo',
  'instrucciones de trabajo', 'instrucción de trabajo', 'lugar de trabajo', 'jornada de trabajo', 'hoja de trabajo',
];

export const TERM_CATALOG: readonly TermDefinition[] = [
  { id: 'job', pluralId: 'jobs', locales: { en: en('Job', 'Jobs', ['job shop', 'job shops']), es: es('Trabajo', 'Trabajos', 'm', ES_TRABAJO_COMPOUNDS) } },
  { id: 'customer', pluralId: 'customers', locales: { en: en('Customer', 'Customers'), es: es('Cliente', 'Clientes', 'm') } },
  { id: 'vendor', pluralId: 'vendors', locales: { en: en('Vendor', 'Vendors'), es: es('Proveedor', 'Proveedores', 'm') } },
  { id: 'part', pluralId: 'parts', locales: { en: en('Part', 'Parts', ['part of', 'parts of', 'in part']), es: es('Pieza', 'Piezas', 'f') } },
  { id: 'work_center', pluralId: 'work_centers', locales: { en: en('Work Center', 'Work Centers'), es: es('Centro de trabajo', 'Centros de trabajo', 'm') } },
  { id: 'quote', pluralId: 'quotes', locales: { en: en('Quote', 'Quotes'), es: es('Cotización', 'Cotizaciones', 'f') } },
  {
    id: 'sales_order', pluralId: 'sales_orders', locales: {
      en: en('Sales Order', 'Sales Orders'),
      es: {
        forms: [
          { text: 'Orden de venta', plural: false, gender: 'f' }, { text: 'Órdenes de venta', plural: true, gender: 'f' },
          { text: 'Pedido de venta', plural: false, gender: 'm' }, { text: 'Pedidos de venta', plural: true, gender: 'm' },
        ],
      },
    },
  },
  { id: 'purchase_order', pluralId: 'purchase_orders', locales: { en: en('Purchase Order', 'Purchase Orders'), es: es('Orden de compra', 'Órdenes de compra', 'f') } },
  { id: 'invoice', pluralId: 'invoices', locales: { en: en('Invoice', 'Invoices'), es: es('Factura', 'Facturas', 'f') } },
  { id: 'shipment', pluralId: 'shipments', locales: { en: en('Shipment', 'Shipments'), es: es('Envío', 'Envíos', 'm') } },
  { id: 'lead', pluralId: 'leads', locales: { en: en('Lead', 'Leads', ['lead time', 'lead times', 'lead-time', 'leads to']), es: es('Prospecto', 'Prospectos', 'm') } },
  { id: 'employee', pluralId: 'employees', locales: { en: en('Employee', 'Employees'), es: es('Empleado', 'Empleados', 'm') } },
  { id: 'asset', pluralId: 'assets', locales: { en: en('Asset', 'Assets'), es: es('Activo', 'Activos', 'm') } },
  { id: 'planning_cycle', pluralId: 'planning_cycles', locales: { en: en('Planning Cycle', 'Planning Cycles'), es: es('Ciclo de planificación', 'Ciclos de planificación', 'm') } },
];

export function singularKey(term: TermDefinition, lang: string): string {
  return withLang(`entity_${term.id}`, lang);
}

export function pluralKey(term: TermDefinition, lang: string): string {
  return withLang(`label_${term.pluralId}`, lang);
}

export function genderKey(term: TermDefinition, lang: string): string {
  return withLang(`gender_${term.id}`, lang);
}

export function catalogKeys(): Set<string> {
  const keys = new Set<string>();
  for (const term of TERM_CATALOG) {
    for (const lang of TERM_LANGUAGES) {
      keys.add(singularKey(term, lang));
      keys.add(pluralKey(term, lang));
      if (lang !== 'en') keys.add(genderKey(term, lang));
    }
  }
  return keys;
}

function withLang(key: string, lang: string): string {
  return lang === 'en' ? key : `${key}:${lang}`;
}
