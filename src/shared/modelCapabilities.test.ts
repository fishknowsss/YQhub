import { describe, expect, it } from 'vitest';
import { MODEL_CAPABILITIES, getDefaultModelCapabilities } from './modelCapabilities';

describe('model capabilities', () => {
  it('keeps seedance2.0fast as the UI default without pretending submit fields are known', () => {
    expect(getDefaultModelCapabilities()).toMatchObject({
      model: 'seedance2.0fast',
      supportedDurations: [4, 5, 8, 10, 15],
      supportedResolutions: ['16:9', '9:16', '1:1'],
      submitMappingStatus: 'pending-docs'
    });
  });

  it('marks the current 小云雀营销成片 Agent mapping as known', () => {
    expect(MODEL_CAPABILITIES.pippit_iv2v_cvtob_master).toMatchObject({
      reqKey: 'pippit_iv2v_cvtob_master',
      submitMappingStatus: 'known'
    });
  });
});
