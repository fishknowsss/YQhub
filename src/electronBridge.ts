import type { ApiAccount, ApiAccountInput, GenerationTask } from './domain/types';

export interface YqhubLocalApi {
  listAccounts(): Promise<ApiAccount[]>;
  addAccount(input: ApiAccountInput): Promise<ApiAccount>;
  deleteAccount(accountId: string): Promise<void>;
  submitTask(task: GenerationTask): Promise<GenerationTask>;
  refreshTask(task: GenerationTask): Promise<GenerationTask>;
}

declare global {
  interface Window {
    yqhub?: YqhubLocalApi;
  }
}

export function getNativeLocalApi(): YqhubLocalApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.yqhub ?? null;
}
