const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yqhub', {
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  addAccount: (input) => ipcRenderer.invoke('accounts:add', input),
  deleteAccount: (accountId) => ipcRenderer.invoke('accounts:delete', accountId),
  submitTask: (task) => ipcRenderer.invoke('tasks:submit', task),
  refreshTask: (task) => ipcRenderer.invoke('tasks:refresh', task),
  openVideo: (target) => ipcRenderer.invoke('videos:open', target)
});
