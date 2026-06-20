import { describe, expect, it } from 'vitest';
import { MODEL_CAPABILITIES, getDefaultModelCapabilities } from './modelCapabilities';

describe('model capabilities', () => {
  it('uses the Xiaoyunque Seedance 2.0 Mini submit model id', () => {
    expect(getDefaultModelCapabilities()).toMatchObject({
      model: 'Seedance_2.0_mini',
      apiModelId: 'Seedance_2.0_mini',
      supportedDurations: ['5', '10', '15'],
      supportedResolutions: ['720p'],
      supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
      submitMappingStatus: 'known'
    });
  });

  it('keeps the previous Fast model as a 720p-only fallback option', () => {
    expect(MODEL_CAPABILITIES['seedance2.0fast']).toMatchObject({
      apiModelId: 'seedance2.0_fast_direct',
      supportedResolutions: ['720p'],
      submitMappingStatus: 'known'
    });
  });

  it('does not expose the old marketing agent as a selectable model', () => {
    expect(Object.keys(MODEL_CAPABILITIES)).not.toContain('pippit_iv2v_cvtob_master');
  });
});
