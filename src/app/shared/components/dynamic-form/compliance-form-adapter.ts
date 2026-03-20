import {
  DynamicFormControlModel,
  DynamicFormModel,
  DynamicInputModel,
  DynamicSelectModel,
  DynamicDatePickerModel,
  DynamicCheckboxModel,
  DynamicRadioGroupModel,
  DynamicValidatorsConfig,
} from '@danielhokanson/ng-dynamic-forms-core';

import {
  ComplianceFormDefinition,
  FormFieldDefinition,
  FormSection,
  normalizeFormPages,
} from '../../models/compliance-form-definition.model';
import {
  QB_FORM_CONTROL_TYPE_HEADING,
  QB_FORM_CONTROL_TYPE_PARAGRAPH,
  QB_FORM_CONTROL_TYPE_SIGNATURE,
} from './qb-form-control-map';

/** Field types that are display-only (no form control created) */
const DISPLAY_ONLY_TYPES = new Set(['heading', 'paragraph', 'html']);

/**
 * Converts a ComplianceFormDefinition (DB JSON) into ng-dynamic-forms models.
 * All field types are converted — headings and paragraphs become display-only
 * models (no form control), signature becomes an input with QB_SIGNATURE marker.
 *
 * For multi-page forms, converts ALL pages into a single flat model array.
 * Use `sectionsToModels` for per-page conversion.
 */
export function complianceDefinitionToModels(
  definition: ComplianceFormDefinition,
  initialData?: Record<string, unknown> | null,
): DynamicFormModel {
  const pages = normalizeFormPages(definition);
  const allSections = pages.flatMap(p => p.sections);
  return sectionsToModels(allSections, initialData);
}

/**
 * Converts a subset of sections into ng-dynamic-forms models.
 * Used by the renderer to build models per-page (tab).
 */
export function sectionsToModels(
  sections: FormSection[],
  initialData?: Record<string, unknown> | null,
): DynamicFormModel {
  const models: DynamicFormControlModel[] = [];

  for (const section of sections) {
    for (const field of section.fields) {
      const model = fieldToModel(field, initialData);
      if (model) {
        models.push(model);
      }
    }
  }

  return models;
}

/**
 * Checks if a field type produces a form control value (vs display-only heading/paragraph).
 */
export function isValueControl(field: FormFieldDefinition): boolean {
  return !DISPLAY_ONLY_TYPES.has(field.type);
}

function fieldToModel(
  field: FormFieldDefinition,
  initialData?: Record<string, unknown> | null,
): DynamicFormControlModel | null {
  const initial = initialData?.[field.id] ?? field.defaultValue;
  const validators = buildValidators(field);

  switch (field.type) {
    case 'heading':
      return new DynamicInputModel({
        id: field.id,
        label: field.label,
        disabled: true,
        additional: {
          qbType: QB_FORM_CONTROL_TYPE_HEADING,
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });

    case 'paragraph':
      return new DynamicInputModel({
        id: field.id,
        label: field.label,
        disabled: true,
        additional: {
          qbType: QB_FORM_CONTROL_TYPE_PARAGRAPH,
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });

    case 'signature':
      return new DynamicInputModel({
        id: field.id,
        label: field.label,
        inputType: 'text',
        required: !!field.required,
        value: initial != null ? String(initial) : '',
        validators,
        additional: {
          qbType: QB_FORM_CONTROL_TYPE_SIGNATURE,
          hint: field.hint,
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });

    case 'text':
    case 'ssn':
      return new DynamicInputModel({
        id: field.id,
        label: field.label,
        inputType: 'text',
        placeholder: field.hint ?? '',
        required: !!field.required,
        maxLength: field.maxlength ?? undefined,
        value: initial != null ? String(initial) : '',
        validators,
        additional: {
          mask: field.type === 'ssn' ? 'ssn' : (field.mask ?? null),
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });

    case 'number':
      return new DynamicInputModel({
        id: field.id,
        label: field.label,
        inputType: 'number',
        placeholder: field.hint ?? '',
        required: !!field.required,
        value: initial != null ? initial as number : undefined,
        prefix: field.prefix,
        suffix: field.suffix,
        validators,
        additional: {
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });

    case 'currency':
      return new DynamicInputModel({
        id: field.id,
        label: field.label,
        inputType: 'number',
        placeholder: field.hint ?? '',
        required: !!field.required,
        value: initial != null ? initial as number : undefined,
        prefix: '$',
        validators,
        additional: {
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });

    case 'date': {
      let dateValue: Date | undefined;
      if (initial) {
        dateValue = initial instanceof Date ? initial : new Date(initial as string);
      }
      // Auto-populate date fields with today if ID contains 'date' and no initial
      if (!dateValue && field.id.toLowerCase().includes('date')) {
        dateValue = new Date();
      }
      return new DynamicDatePickerModel({
        id: field.id,
        label: field.label,
        required: !!field.required,
        value: dateValue,
        validators,
        additional: {
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });
    }

    case 'select':
      return new DynamicSelectModel<string>({
        id: field.id,
        label: field.label,
        required: !!field.required,
        value: initial != null ? String(initial) : undefined,
        options: (field.options ?? []).map(o => ({ value: o.value, label: o.label })),
        validators,
        additional: {
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });

    case 'radio':
      return new DynamicRadioGroupModel<string>({
        id: field.id,
        label: field.label,
        required: !!field.required,
        value: initial != null ? String(initial) : undefined,
        options: (field.options ?? []).map(o => ({ value: o.value, label: o.label })),
        validators,
        additional: {
          width: field.width ?? 'full',
          optionHints: (field.options ?? []).reduce(
            (acc, o) => (o.hint ? { ...acc, [o.value]: o.hint } : acc),
            {} as Record<string, string>,
          ),
          qbFieldType: field.type,
        },
      });

    case 'checkbox':
      return new DynamicCheckboxModel({
        id: field.id,
        label: field.label,
        required: !!field.required,
        value: initial != null ? !!initial : false,
        validators,
        additional: {
          width: field.width ?? 'full',
          qbFieldType: field.type,
        },
      });

    default:
      return null;
  }
}

function buildValidators(field: FormFieldDefinition): DynamicValidatorsConfig {
  const config: DynamicValidatorsConfig = {};
  if (field.required) config['required'] = null;
  if (field.maxlength) config['maxLength'] = field.maxlength;
  return config;
}
