export const MODEL_CAPABILITIES = {
  'seedance2.0fast': {
    model: 'seedance2.0fast',
    displayName: 'Seedance 2.0 Fast',
    reqKey: 'pippit_iv2v_v20_cvtob_with_vinput',
    supportsPrompt: true,
    supportsImageReference: true,
    supportsVideoReference: true,
    supportsAudioReference: false,
    supportedDurations: ['～15s', '～30s', '40～60s'],
    supportedResolutions: ['16:9', '9:16', '4:3', '3:4'],
    submitMappingStatus: 'known'
  }
} as const;

export type ModelId = keyof typeof MODEL_CAPABILITIES;

export function getDefaultModelCapabilities() {
  return MODEL_CAPABILITIES['seedance2.0fast'];
}

export function isModelId(value: string): value is ModelId {
  return value in MODEL_CAPABILITIES;
}
