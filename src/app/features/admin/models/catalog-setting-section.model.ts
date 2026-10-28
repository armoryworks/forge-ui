import { CatalogSettingField } from './catalog-setting-field.model';

/** A section of Admin > Settings drawn from one settings-catalog group: the fields it shows, in order. */
export interface CatalogSettingSection {
  key: string;
  group: string;
  titleKey: string;
  icon: string;
  fields: CatalogSettingField[];
}
