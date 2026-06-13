import { contextBridge, ipcRenderer } from 'electron';
import type { ApiAccount, ApiAccountInput } from '../src/domain/types';

export interface YqLocalApi {
  listAccounts(): Promise<ApiAccount[]>;
  addAccount(input: ApiAccountInput): Promise<ApiAccount>;
  deleteAccount(accountId: string): Promise<void>;
}

const api: YqLocalApi = {
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  addAccount: (input) => ipcRenderer.invoke('accounts:add', input),
  deleteAccount: (accountId) => ipcRenderer.invoke('accounts:delete', accountId)
};

contextBridge.exposeInMainWorld('yqLocal', api);
