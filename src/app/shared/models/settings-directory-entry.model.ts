import { RouteAccess } from './route-access.model';

/**
 * A setting in the settings search: the labels it is found by (the first names it), the screen it is set on,
 * the link that opens it there, and the role and capability rule of that screen.
 */
export interface SettingsDirectoryEntry {
  key: string;
  textKeys: string[];
  whereKey: string;
  route: string;
  queryParams?: Record<string, string>;
  access: RouteAccess;
}
