import { describe, expect, it } from 'vitest';
import { MODEL_CAPABILITIES, getDefaultModelCapabilities } from './modelCapabilities';

describe('model capabilities', () => {
  it('uses seedance2.0fast as the documented default submit model', () => {
    expect(getDefaultModelCapabilities()).toMatchObject({
      model: 'seedance2.0fast',
      reqKey: 'pippit_iv2v_v20_cvtob_with_vinput',
      supportedDurations: ['～15s', '～30s', '40～60s'],
      supportedResolutions: ['16:9', '9:16', '4:3', '3:4'],
      submitMappingStatus: 'known'
    });
  });

  it('does not expose the old marketing agent as a selectable model', () => {
    expect(Object.keys(MODEL_CAPABILITIES)).not.toContain('pippit_iv2v_cvtob_master');
  });
});
