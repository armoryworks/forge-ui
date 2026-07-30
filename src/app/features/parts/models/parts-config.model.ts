/** Client-facing parts configuration returned by GET /parts/config. */
export interface PartsConfig {
  /** When true, the create form lets the user supply their own part number. */
  allowManualPartNumbers: boolean;
}
