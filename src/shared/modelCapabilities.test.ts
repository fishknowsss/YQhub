import { describe, expect, it } from 'vitest';
import { MODEL_CAPABILITIES, getDefaultModelCapabilities } from './modelCapabilities';

describe('model capabilities', () => {
  it('uses the Xiaoyunque Seedance 2.0 Fast direct submit model id', () => {
    expect(getDefaultModelCapabilities()).toMatchObject({
      model: 'seedance2.0fast',
      apiModelId: 'seedance2.0_fast_direct',
      supportedDurations: ['5', '10', '15'],
      supportedResolutions: ['720p', '480p'],
      supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
      submitMappingStatus: 'known'
    });
  });

  it('does not expose the old marketing agent as a selectable model', () => {
    expect(Object.keys(MODEL_CAPABILITIES)).not.toContain('pippit_iv2v_cvtob_master');
  });
});
