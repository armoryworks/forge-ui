/**
 * The enrolled Forge instance the native shell talks to. Every field lives in
 * secure storage; nothing about an instance is shared with any other.
 */
export interface MobileInstance {
  /** Stable key derived from the server host; namespaces this instance's credentials. */
  id: string;
  /** Origin of the server, e.g. https://shop.example.com — no trailing slash. */
  serverUrl: string;
  name: string;
  /** TOFU-pinned certificate fingerprint (SHA-256 hex), null when the instance publishes none. */
  certSha256: string | null;
  deviceUuid: string;
  deviceId: number;
  deviceName: string;
  /** Enrolled to the instance, not a person: every transaction starts with badge + PIN. */
  shared: boolean;
}
