import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.armoryworks.forge',
  appName: 'Forge',
  webDir: 'dist/forge-ui-mobile/browser',
  // No `server.url`: web assets ship inside the binary. The API host is
  // per-instance and resolved at runtime by the enrollment/instance layer.
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
