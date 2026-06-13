import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
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
import { createVolcengineClient } from '../src/services/volcengineClient';

interface MainStoreSchema {
  accounts: ApiAccount[];
  secrets: Record<string, string>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store<MainStoreSchema>({
  name: 'yq-local-video-client',
  defaults: {
    accounts: [],
    secrets: {}
  }
});
const accountService = createAccountService({
  vault: createElectronSecretVault(store),
  initialAccounts: store.get('accounts') ?? []
});
const visualClient = createVolcengineClient();
const downloadService = createDownloadService();
const queueService = createQueueService({
  accountService,
  client: visualClient
});
const taskService = createTaskService({
  accountService,
  client: visualClient,
  downloadService
});

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
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: '小云雀本地生成端',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
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

await app.whenReady();
await createWindow();

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
