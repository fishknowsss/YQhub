import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron';
import Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiAccount, ApiAccountInput } from '../src/domain/types';
import {
  createAccountService,
  type SecretVault
} from '../src/main/services/accountService';
import { createDownloadService } from '../src/main/services/downloadService';
import { createQueueService } from '../src/main/services/queueService';
import { createTaskService } from '../src/main/services/taskService';
import { createXiaoyunqueClient } from '../src/services/xiaoyunqueClient';

interface MainStoreSchema {
  accounts: ApiAccount[];
  settings: {
    exportDirectory?: string;
  };
  secrets: Record<string, string>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store<MainStoreSchema>({
  name: 'yqhub',
  defaults: {
    accounts: [],
    settings: {},
    secrets: {}
  }
});
const accountService = createAccountService({
  vault: createElectronSecretVault(store),
  initialAccounts: store.get('accounts') ?? []
});
const videoClient = createXiaoyunqueClient();
const downloadService = createDownloadService({
  outputDirectory: getExportDirectory
});
const queueService = createQueueService({
  accountService,
  client: videoClient
});
const taskService = createTaskService({
  accountService,
  client: videoClient,
  downloadService
});
let mainWindow: BrowserWindow | null = null;

function createElectronSecretVault(localStore: Store<MainStoreSchema>): SecretVault {
  return {
    writeSecret(secret) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('当前系统不支持安全密钥存储');
      }

      const ref = `electron-safe:${randomUUID()}`;
      const encrypted = safeStorage.encryptString(secret).toString('base64');
      const secrets = localStore.get('secrets') ?? {};
      localStore.set('secrets', {
        ...secrets,
        [ref]: encrypted
      });
      return ref;
    },
    readSecret(ref) {
      const encrypted = localStore.get('secrets')?.[ref];

      if (!encrypted) {
        throw new Error('密钥不存在');
      }

      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    },
    deleteSecret(ref) {
      const secrets = { ...(localStore.get('secrets') ?? {}) };
      delete secrets[ref];
      localStore.set('secrets', secrets);
    }
  };
}

function persistAccounts(): void {
  store.set('accounts', accountService.listAccounts());
}

function registerIpcHandlers(): void {
  ipcMain.handle('accounts:list', () => accountService.listAccounts());
  ipcMain.handle('accounts:add', (_event, input: ApiAccountInput) => {
    const account = accountService.addAccount(input);
    persistAccounts();
    return account;
  });
  ipcMain.handle('accounts:delete', (_event, accountId: string) => {
    accountService.deleteAccount(accountId);
    persistAccounts();
  });
  ipcMain.handle('tasks:submit', (_event, task) => queueService.submit(task));
  ipcMain.handle('tasks:refresh', (_event, task) => taskService.refreshTask(task));
  ipcMain.handle('videos:open', (_event, target: string) => openVideoTarget(target));
  ipcMain.handle('settings:getExportDirectory', async () => getExportDirectory());
  ipcMain.handle('settings:chooseExportDirectory', () => chooseExportDirectory());
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    title: 'YQhub',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  mainWindow = window;
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  window.on('ready-to-show', () => {
    window.show();
    window.focus();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalTarget(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      void openExternalTarget(url);
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await window.loadURL(devServerUrl);
    return;
  }

  await window.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
}

registerIpcHandlers();

void app
  .whenReady()
  .then(createWindow)
  .catch((error: unknown) => {
    console.error('YQhub failed to start', error);
    app.quit();
  });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export function getMainWindowForTest(): BrowserWindow | null {
  return mainWindow;
}

function getExportDirectory(): string {
  return store.get('settings')?.exportDirectory ?? getDefaultExportDirectory();
}

function getDefaultExportDirectory(): string {
  return path.join(app.getPath('home'), 'Movies', 'YQhub', 'exports');
}

async function chooseExportDirectory(): Promise<string> {
  const result = await dialog.showOpenDialog({
    defaultPath: getExportDirectory(),
    properties: ['openDirectory', 'createDirectory'],
    title: '选择保存位置'
  });

  if (result.canceled || !result.filePaths[0]) {
    return getExportDirectory();
  }

  const selectedPath = result.filePaths[0];
  store.set('settings', {
    ...(store.get('settings') ?? {}),
    exportDirectory: selectedPath
  });
  return selectedPath;
}

async function openVideoTarget(target: string): Promise<void> {
  const trimmedTarget = target.trim();

  if (!trimmedTarget) {
    throw new Error('成片还没生成');
  }

  if (isHttpUrl(trimmedTarget)) {
    await shell.openExternal(trimmedTarget);
    return;
  }

  const localPath = normalizeLocalPath(trimmedTarget);
  const errorMessage = await shell.openPath(localPath);

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

async function openExternalTarget(target: string): Promise<void> {
  if (isHttpUrl(target)) {
    await shell.openExternal(target);
  }
}

function normalizeLocalPath(target: string): string {
  if (target.startsWith('file://')) {
    return fileURLToPath(target);
  }

  if (target === '~' || target.startsWith('~/')) {
    return path.join(app.getPath('home'), target.slice(2));
  }

  if (path.isAbsolute(target)) {
    return target;
  }

  throw new Error('成片路径不正确');
}

function isAppUrl(url: string): boolean {
  return url.startsWith('file://');
}

function isHttpUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}
