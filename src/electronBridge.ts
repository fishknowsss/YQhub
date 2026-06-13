import type { ApiAccount, ApiAccountInput } from './domain/types';

export interface YqLocalApi {
  listAccounts(): Promise<ApiAccount[]>;
  addAccount(input: ApiAccountInput): Promise<ApiAccount>;
  deleteAccount(accountId: string): Promise<void>;
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
