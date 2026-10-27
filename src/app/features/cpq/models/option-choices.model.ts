/** An option's allowed values read from its values JSON: a list of choices, or a numeric range. */
export interface OptionChoices {
  choices: { value: string; label: string }[];
  min: number | null;
  max: number | null;
}
