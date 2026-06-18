import type {
  ApiAccount,
  ApiAccountInput,
  AssetReference,
  DraftState,
  GenerationTask,
  WorkspaceState
} from './types';

const DEFAULT_MODEL = 'seedance2.0fast';
const XIAOYUNQUE_API_KEY_PATTERN = /^ak-[A-Za-z0-9_-]{12,}$/u;
const XIAOYUNQUE_API_KEY_ERROR = '只支持小云雀官网发放的 ak- API Key';

export function createInitialDraft(): DraftState {
  return {
    prompt: '',
    assets: [],
    duration: '15',
    resolution: '720p',
    ratio: '9:16',
    model: DEFAULT_MODEL,
    outputName: ''
  };
}

export function createInitialState(): WorkspaceState {
  return {
    version: 1,
    accounts: [],
    currentAccountId: null,
    draft: createInitialDraft(),
    tasks: []
  };
}

export function addApiAccount(state: WorkspaceState, input: ApiAccountInput): WorkspaceState {
  assertXiaoyunqueApiKey(input.apiKey);

  const now = new Date().toISOString();
  const account: ApiAccount = {
    id: `account-${state.accounts.length + 1}`,
    name: input.name.trim() || '未命名账号',
    apiKeyPreview: maskApiKey(input.apiKey),
    apiKeyRef: createKeyReference(input),
    concurrencyLimit: input.concurrencyLimit ?? 1,
    enabled: true,
    createdAt: now,
    updatedAt: now
  };

  return {
    ...state,
    accounts: [...state.accounts, account],
    currentAccountId: state.currentAccountId ?? account.id
  };
}

export function isXiaoyunqueApiKey(apiKey: string): boolean {
  return XIAOYUNQUE_API_KEY_PATTERN.test(apiKey.trim());
}

export function assertXiaoyunqueApiKey(apiKey: string): void {
  if (!isXiaoyunqueApiKey(apiKey)) {
    throw new Error(XIAOYUNQUE_API_KEY_ERROR);
  }
}

export function selectAccount(state: WorkspaceState, accountId: string): WorkspaceState {
  if (!state.accounts.some((account) => account.id === accountId)) {
    throw new Error('账号不存在');
  }

  return {
    ...state,
    currentAccountId: accountId
  };
}

export function updateDraft(
  state: WorkspaceState,
  patch: Partial<DraftState>
): WorkspaceState {
  return {
    ...state,
    draft: {
      ...state.draft,
      ...patch
    }
  };
}

export function clearDraft(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    draft: createInitialDraft()
  };
}

export function createGenerationTask(state: WorkspaceState): WorkspaceState {
  if (!state.currentAccountId) {
    throw new Error('请先添加 API 账号');
  }

  const now = new Date().toISOString();
  const task: GenerationTask = {
    id: `local-task-${state.tasks.length + 1}`,
    accountId: state.currentAccountId,
    prompt: state.draft.prompt,
    finalPrompt: buildFinalPrompt(state.draft.prompt, state.draft.assets),
    assets: state.draft.assets,
    duration: state.draft.duration,
    resolution: state.draft.resolution,
    ratio: state.draft.ratio,
    model: state.draft.model,
    outputName: state.draft.outputName.trim(),
    status: 'in_queue',
    progress: 10,
    etaSeconds: null,
    apiTaskId: null,
    videoUrl: null,
    localVideoPath: null,
    errorCode: null,
    errorMessage: null,
    requestId: null,
    createdAt: now,
    updatedAt: now
  };

  return {
    ...state,
    tasks: [...state.tasks, task]
  };
}

export function buildFinalPrompt(prompt: string, assets: AssetReference[]): string {
  const cleanPrompt = prompt.trim();
  const labels = assets.map((asset) => asset.label.trim()).filter(Boolean);

  if (labels.length === 0) {
    return cleanPrompt;
  }

  if (!cleanPrompt) {
    return labels.join('\n');
  }

  return `${cleanPrompt}\n\n${labels.join('\n')}`;
}

function createKeyReference(input: ApiAccountInput): string {
  const source = `${input.apiKey}:${input.name}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return `local-key:${hash.toString(16).padStart(8, '0')}`;
}

export function maskApiKey(apiKey: string): string {
  const value = apiKey.trim();

  if (value.length <= 8) {
    return value ? '已保存' : '';
  }

  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}
