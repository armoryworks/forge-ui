export interface ComplianceFormDefinition {
  formType: string;
  title: string;
  formNumber: string;
  revision: string;
  agency: string;
  /** Flat sections (legacy / simple forms). Ignored when `pages` is present. */
  sections?: FormSection[];
  /** Multi-page forms rendered as tabs. Each page groups one or more sections. */
  pages?: FormPage[];
  /** Layout mode — 'government' uses IRS-style native rendering; default uses Material wrappers */
  formLayout?: 'default' | 'government';
  /** Max width for the form body (e.g., "850px") — form is centered when set */
  maxWidth?: string;
  /** CSS custom property overrides computed from PDF extraction metrics */
  formStyles?: Record<string, string>;
}

export interface FormPage {
  id: string;
  title: string;
  /** Read-only pages display content without interactive controls */
  readonly?: boolean;
  sections: FormSection[];
}

export interface FormSection {
  id: string;
  title: string;
  subtitle?: string;
  instructions?: string;
  optional?: boolean;
  fields: FormFieldDefinition[];

  // ─── Government form layout metadata ───
  /** Section layout type — determines rendering strategy */
  layout?: 'default' | 'section' | 'form-header' | 'step' | 'step-amounts' | 'tip' | 'exempt' | 'sign' | 'employers-only' | 'form-footer' | 'worksheet' | 'instructions';
  /** Whether section has shaded (blue) background */
  shaded?: boolean;
  /** Step number label (e.g., "Step 1:") */
  stepNumber?: string;
  /** Step name displayed below step number */
  stepName?: string;
  /** Width of the outer amount column (e.g., "155px") */
  amountColumnWidth?: string;
  /** Width of the inner amount column for sub-items (e.g., "240px") */
  innerColumnWidth?: string;
  /** Heavy bottom border (2px) — e.g., sign section */
  heavyBorder?: boolean;
  /** CSS grid column template for grid-based sections (e.g., Step 1) */
  gridColumns?: string;
  /** Inline styles applied to the section container */
  style?: Record<string, string>;
  /** Max width for centering (e.g., "850px") */
  maxWidth?: string;
  /** Content rendered as HTML (for rich text sections like instructions) */
  html?: string;
}

export interface FormFieldDefinition {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'currency' | 'ssn' | 'date' | 'select' | 'radio' | 'checkbox' | 'signature' | 'heading' | 'paragraph' | 'html';
  label: string;
  hint?: string;
  required?: boolean;
  options?: FormFieldOption[];
  maxlength?: number;
  mask?: string;
  width?: 'full' | 'half' | 'third' | 'quarter';
  dependsOn?: FormFieldDependency;
  defaultValue?: string | number | boolean;
  prefix?: string;
  suffix?: string;

  // ─── Government form field layout metadata ───
  /** Field layout hint for IRS-style rendering */
  fieldLayout?: 'amount-line' | 'amount-line-inner' | 'amount-line-total' | 'grid-cell' | 'checkbox-dots' | 'signature-field' | 'signature-date' | 'filing-status' | 'worksheet-line';
  /** Amount line label (e.g., "3(a)", "4(b)") displayed in the shaded column */
  amountLabel?: string;
  /** CSS grid column placement (e.g., "1", "1 / 3", "3") */
  gridColumn?: string;
  /** CSS grid row placement (e.g., "1", "2 / 4") */
  gridRow?: string;
  /** Inline styles applied to the field container */
  style?: Record<string, string>;
  /** CSS class(es) to apply */
  cssClass?: string;
  /** Checkbox visual style — 'square' for W-4 filing status boxes */
  checkboxStyle?: 'circle' | 'square';
  /** Autocomplete attribute for native inputs */
  autocomplete?: string;
  /** Placeholder text for native inputs */
  placeholder?: string;
  /** Whether this is a display-only text block within a step (rendered as plain text, not Material) */
  displayText?: string;
  /** Worksheet line number */
  worksheetLineNumber?: string;
  /** Rich HTML content for html-type fields */
  html?: string;
  /** Number of rows for textarea fields */
  rows?: number;
  /** When true, suppresses the visible label inside the grid cell (label still used for aria-label) */
  noLabel?: boolean;
}

export interface FormFieldOption {
  value: string;
  label: string;
  hint?: string;
}

export interface FormFieldDependency {
  field: string;
  value: string | boolean;
  operator?: 'eq' | 'neq' | 'truthy';
}

/**
 * Normalizes a form definition so consumers always work with `pages`.
 * If the definition uses flat `sections` (legacy), wraps them in a single page.
 */
export function normalizeFormPages(def: ComplianceFormDefinition): FormPage[] {
  if (def.pages?.length) return def.pages;
  if (def.sections?.length) {
    return [{ id: 'page1', title: def.title, sections: def.sections }];
  }
  return [];
}
