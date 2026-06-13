export const MODEL_CAPABILITIES = {
  'seedance2.0fast': {
    model: 'seedance2.0fast',
    displayName: 'Seedance 2.0 Fast',
    supportsPrompt: true,
    supportsImageReference: true,
    supportsVideoReference: false,
    supportsAudioReference: false,
    supportedDurations: [4, 5, 8, 10, 15],
    supportedResolutions: ['16:9', '9:16', '1:1'],
    submitMappingStatus: 'pending-docs'
  },
  pippit_iv2v_cvtob_master: {
    model: 'pippit_iv2v_cvtob_master',
    displayName: '小云雀营销成片 Agent',
    reqKey: 'pippit_iv2v_cvtob_master',
    supportsPrompt: false,
    supportsImageReference: true,
    supportsVideoReference: false,
    supportsAudioReference: false,
    supportedDurations: [],
    supportedResolutions: [],
    submitMappingStatus: 'known'
  }
} as const;

export type ModelId = keyof typeof MODEL_CAPABILITIES;

export function getDefaultModelCapabilities() {
  return MODEL_CAPABILITIES['seedance2.0fast'];
}
