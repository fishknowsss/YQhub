import { contextBridge, ipcRenderer } from 'electron';
import type { ApiAccount, ApiAccountInput, GenerationTask } from '../src/domain/types';

export interface YqhubLocalApi {
  listAccounts(): Promise<ApiAccount[]>;
  addAccount(input: ApiAccountInput): Promise<ApiAccount>;
  deleteAccount(accountId: string): Promise<void>;
  submitTask(task: GenerationTask): Promise<GenerationTask>;
  refreshTask(task: GenerationTask): Promise<GenerationTask>;
  openVideo(target: string): Promise<void>;
  getExportDirectory(): Promise<string>;
  chooseExportDirectory(): Promise<string>;
  showEditContextMenu(): Promise<void>;
}

const api: YqhubLocalApi = {
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  addAccount: (input) => ipcRenderer.invoke('accounts:add', input),
  deleteAccount: (accountId) => ipcRenderer.invoke('accounts:delete', accountId),
  submitTask: (task) => ipcRenderer.invoke('tasks:submit', task),
  refreshTask: (task) => ipcRenderer.invoke('tasks:refresh', task),
  openVideo: (target) => ipcRenderer.invoke('videos:open', target),
  getExportDirectory: () => ipcRenderer.invoke('settings:getExportDirectory'),
  chooseExportDirectory: () => ipcRenderer.invoke('settings:chooseExportDirectory'),
  showEditContextMenu: () => ipcRenderer.invoke('edit:showContextMenu')
};

contextBridge.exposeInMainWorld('yqhub', api);
