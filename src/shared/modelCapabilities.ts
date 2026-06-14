export const MODEL_CAPABILITIES = {
  'seedance2.0fast': {
    model: 'seedance2.0fast',
    displayName: 'Seedance 2.0 Fast',
    apiModelId: 'seedance2.0_fast_direct',
    supportsPrompt: true,
    supportsImageReference: true,
    supportsVideoReference: true,
    supportsAudioReference: true,
    supportedDurations: ['5', '10', '15'],
    supportedResolutions: ['720p', '480p'],
    supportedRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
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
