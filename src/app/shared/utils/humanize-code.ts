/**
 * Turns a PascalCase or camelCase code ("OfficeManager", "UserLoggedIn") into
 * spaced words ("Office Manager", "User Logged In"). Acronym runs stay together
 * ("BIApiKeyIssued" → "BI Api Key Issued"). A code that already contains
 * whitespace is returned unchanged.
 */
export function humanizeCode(code: string): string {
  if (!code || /\s/.test(code)) return code;
  return code
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}
