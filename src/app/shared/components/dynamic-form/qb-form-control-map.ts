import { Type } from '@angular/core';

import {
  DynamicFormControlModel,
  DYNAMIC_FORM_CONTROL_TYPE_INPUT,
  DYNAMIC_FORM_CONTROL_TYPE_SELECT,
  DYNAMIC_FORM_CONTROL_TYPE_DATEPICKER,
  DYNAMIC_FORM_CONTROL_TYPE_TEXTAREA,
  DYNAMIC_FORM_CONTROL_TYPE_SWITCH,
  DYNAMIC_FORM_CONTROL_TYPE_CHECKBOX,
  DYNAMIC_FORM_CONTROL_TYPE_RADIO_GROUP,
  DYNAMIC_FORM_CONTROL_TYPE_GROUP,
} from '@danielhokanson/ng-dynamic-forms-core';

import { DynamicQbInputComponent } from './controls/dynamic-qb-input.component';
import { DynamicQbSelectComponent } from './controls/dynamic-qb-select.component';
import { DynamicQbDatepickerComponent } from './controls/dynamic-qb-datepicker.component';
import { DynamicQbTextareaComponent } from './controls/dynamic-qb-textarea.component';
import { DynamicQbToggleComponent } from './controls/dynamic-qb-toggle.component';
import { DynamicQbCheckboxComponent } from './controls/dynamic-qb-checkbox.component';
import { DynamicQbRadioGroupComponent } from './controls/dynamic-qb-radio-group.component';
import { DynamicQbFormGroupComponent } from './controls/dynamic-qb-form-group.component';
import { DynamicQbSignatureComponent } from './controls/dynamic-qb-signature.component';
import { DynamicQbHeadingComponent } from './controls/dynamic-qb-heading.component';
import { DynamicQbParagraphComponent } from './controls/dynamic-qb-paragraph.component';

/** Custom QB type constants for non-standard form elements */
export const QB_FORM_CONTROL_TYPE_HEADING = 'QB_HEADING';
export const QB_FORM_CONTROL_TYPE_PARAGRAPH = 'QB_PARAGRAPH';
export const QB_FORM_CONTROL_TYPE_SIGNATURE = 'QB_SIGNATURE';

export function qbFormControlMapFn(model: DynamicFormControlModel): Type<unknown> | null {
  // Check for QB custom types via additional metadata first
  const m = model as unknown as Record<string, unknown>;
  const qbType = m['additional']
    ? (m['additional'] as Record<string, unknown>)?.['qbType']
    : null;

  if (qbType === QB_FORM_CONTROL_TYPE_HEADING) return DynamicQbHeadingComponent;
  if (qbType === QB_FORM_CONTROL_TYPE_PARAGRAPH) return DynamicQbParagraphComponent;
  if (qbType === QB_FORM_CONTROL_TYPE_SIGNATURE) return DynamicQbSignatureComponent;

  switch (model.type) {
    case DYNAMIC_FORM_CONTROL_TYPE_INPUT:
      return DynamicQbInputComponent;
    case DYNAMIC_FORM_CONTROL_TYPE_SELECT:
      return DynamicQbSelectComponent;
    case DYNAMIC_FORM_CONTROL_TYPE_DATEPICKER:
      return DynamicQbDatepickerComponent;
    case DYNAMIC_FORM_CONTROL_TYPE_TEXTAREA:
      return DynamicQbTextareaComponent;
    case DYNAMIC_FORM_CONTROL_TYPE_SWITCH:
      return DynamicQbToggleComponent;
    case DYNAMIC_FORM_CONTROL_TYPE_CHECKBOX:
      return DynamicQbCheckboxComponent;
    case DYNAMIC_FORM_CONTROL_TYPE_RADIO_GROUP:
      return DynamicQbRadioGroupComponent;
    case DYNAMIC_FORM_CONTROL_TYPE_GROUP:
      return DynamicQbFormGroupComponent;
    default:
      return null;
  }
}
