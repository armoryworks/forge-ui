import { Address } from '../models/address.model';

/**
 * Maps flat address fields (street1/address, city, state, zipCode, country) to an Address object.
 * Returns null if all fields are empty.
 */
export function toAddress(fields: {
  street1?: string | null;
  address?: string | null;
  line1?: string | null;
  street2?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): Address | null {
  const line1 = fields.street1 ?? fields.address ?? fields.line1 ?? '';
  const line2 = fields.street2 ?? fields.line2;
  const city = fields.city ?? '';
  const state = fields.state ?? '';
  const postalCode = fields.zipCode ?? fields.postalCode ?? '';
  const country = fields.country ?? 'US';

  if (!line1 && !city && !state && !postalCode) return null;

  return { line1, line2, city, state, postalCode, country };
}

/**
 * Maps an Address object back to flat fields using street1/street2/zipCode naming.
 * Suitable for employee profile payloads.
 */
export function fromAddressToProfile(addr: Address | null): {
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
} {
  return {
    street1: addr?.line1 ?? null,
    street2: addr?.line2 ?? null,
    city: addr?.city ?? null,
    state: addr?.state ?? null,
    zipCode: addr?.postalCode ?? null,
    country: addr?.country ?? null,
  };
}

/**
 * Maps an Address object back to flat fields using address/zipCode naming.
 * Suitable for vendor payloads.
 */
export function fromAddressToVendor(addr: Address | null): {
  address: string | undefined;
  city: string | undefined;
  state: string | undefined;
  zipCode: string | undefined;
  country: string | undefined;
} {
  return {
    address: addr?.line1 || undefined,
    city: addr?.city || undefined,
    state: addr?.state || undefined,
    zipCode: addr?.postalCode || undefined,
    country: addr?.country || undefined,
  };
}
