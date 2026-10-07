import { CAPABILITY_RELATED_SETTINGS } from './capability-related-settings.const';
import { NUMBERING_SETTING_LABELS } from './numbering-setting-labels.const';

describe('CAPABILITY_RELATED_SETTINGS', () => {
  it('links every numbering toggle from exactly one capability', () => {
    const linked = Object.values(CAPABILITY_RELATED_SETTINGS).flat().sort();
    const toggles = NUMBERING_SETTING_LABELS.map((l) => l.key).sort();

    expect(linked).toEqual(toggles);
  });

  it('links the parts capability to the manual part number toggle', () => {
    expect(CAPABILITY_RELATED_SETTINGS['CAP-MD-PARTS']).toEqual(['parts.allow_manual_numbers']);
  });
});
