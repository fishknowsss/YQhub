import type { ApiAccount, ApiAccountInput, GenerationTask } from './domain/types';

export interface YqLocalApi {
  listAccounts(): Promise<ApiAccount[]>;
  addAccount(input: ApiAccountInput): Promise<ApiAccount>;
  deleteAccount(accountId: string): Promise<void>;
  submitTask(task: GenerationTask): Promise<GenerationTask>;
  refreshTask(task: GenerationTask): Promise<GenerationTask>;
}

declare global {
  interface Window {
    yqLocal?: YqLocalApi;
  }
}

export function getNativeLocalApi(): YqLocalApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.yqLocal ?? null;
}
