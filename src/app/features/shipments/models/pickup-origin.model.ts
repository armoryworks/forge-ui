/** Where a carrier collects shipments: the default company location and the time zone its pickup times are in. */
export interface PickupOrigin {
  locationName: string | null;
  timeZone: string | null;
}
