export interface AmbientIdleOption {
  value: number;
  label: string;
}

export const AMBIENT_IDLE_OPTIONS: AmbientIdleOption[] = [
  { value: 0,                label: 'Off' },
  { value: 1 * 60 * 1000,    label: '1 minute' },
  { value: 5 * 60 * 1000,    label: '5 minutes' },
  { value: 15 * 60 * 1000,   label: '15 minutes' },
  { value: 30 * 60 * 1000,   label: '30 minutes' },
  { value: 60 * 60 * 1000,   label: '1 hour' },
];

export const DEFAULT_AMBIENT_IDLE_MS = 0;
export const AMBIENT_IDLE_PREF_KEY = 'ambient:idleTimeoutMs';
