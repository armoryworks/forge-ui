import { ConfiguratorOption } from '../models/configurator-option.model';
import { OptionChoices } from '../models/option-choices.model';

/** Reads an option's values JSON the way the API's CPQ engine does; anything unreadable allows any value. */
export function optionChoices(option: ConfiguratorOption): OptionChoices {
  const empty: OptionChoices = { choices: [], min: null, max: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(option.valuesJson || '[]');
  } catch {
    return empty;
  }
  if (Array.isArray(parsed)) {
    const choices = parsed.flatMap(item => {
      if (typeof item === 'string' || typeof item === 'number') return [{ value: String(item), label: String(item) }];
      if (item && typeof item === 'object' && typeof (item as { value?: unknown }).value === 'string') {
        const value = (item as { value: string }).value;
        const label = (item as { label?: unknown }).label;
        return [{ value, label: typeof label === 'string' && label ? label : value }];
      }
      return [];
    });
    return { ...empty, choices };
  }
  if (parsed && typeof parsed === 'object') {
    const range = parsed as { min?: unknown; max?: unknown };
    return {
      choices: [],
      min: typeof range.min === 'number' ? range.min : null,
      max: typeof range.max === 'number' ? range.max : null,
    };
  }
  return empty;
}

/** True while an option applies: it depends on nothing, or its parent ("Option" or "Option=Value") holds. */
export function optionIsActive(option: ConfiguratorOption, options: ConfiguratorOption[], selections: Record<string, string>): boolean {
  const spec = option.dependsOnOptionId?.trim();
  if (!spec) return true;
  const [parentKey, required] = spec.split('=').map(s => s.trim());
  const parent = options.find(o => o.name.trim().toLowerCase() === parentKey.toLowerCase() || String(o.id) === parentKey);
  if (!parent || parent === option) return true;
  const raw = (selections[parent.name] ?? '').trim();
  const values = parent.optionType === 'Checkbox'
    ? (raw === 'true' ? ['true'] : [])
    : raw.split(',').map(v => v.trim()).filter(v => v);
  return required === undefined ? values.length > 0 : values.some(v => v.toLowerCase() === required.toLowerCase());
}
