export type AssetType = 'image' | 'video' | 'audio';
export type TaskStatus =
  | 'draft'
  | 'in_queue'
  | 'processing'
  | 'generating'
  | 'done'
  | 'failed'
  | 'expired'
  | 'not_found';

export interface AssetReference {
  id: string;
  type: AssetType;
  label: string;
  localName: string;
  previewUrl: string;
  dataUrl?: string;
  mimeType?: string;
  publicUrl?: string;
  uploadStatus?: 'local' | 'uploaded' | 'failed';
}

export interface ApiAccount {
  id: string;
  name: string;
  apiKeyPreview: string;
  apiKeyRef: string;
  concurrencyLimit: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAccountInput {
  name: string;
  apiKey: string;
  concurrencyLimit?: number;
}

export interface DraftState {
  prompt: string;
  assets: AssetReference[];
  duration: string;
  resolution: string;
  ratio: string;
  model: string;
  outputName: string;
}

export interface GenerationTask {
  id: string;
  accountId: string;
  prompt: string;
  finalPrompt: string;
  assets: AssetReference[];
  duration: string;
  resolution: string;
  ratio: string;
  model: string;
  outputName: string;
  status: TaskStatus;
  progress: number;
  etaSeconds: number | null;
  apiTaskId: string | null;
  videoUrl: string | null;
  localVideoPath: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceState {
  version: 1;
  accounts: ApiAccount[];
  currentAccountId: string | null;
  draft: DraftState;
  tasks: GenerationTask[];
}
