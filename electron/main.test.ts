import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => {
  type WindowHandler = () => void;

  const windows: Array<{
    closedHandler: WindowHandler | null;
    focus: ReturnType<typeof vi.fn>;
    loadFile: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    options: Record<string, unknown>;
    readyToShowHandler: WindowHandler | null;
    show: ReturnType<typeof vi.fn>;
    webContents: {
      getURL: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
    };
  }> = [];

  class BrowserWindowMock {
    closedHandler: WindowHandler | null = null;
    focus = vi.fn();
    loadFile = vi.fn(async () => undefined);
    loadURL = vi.fn(async () => undefined);
    options: Record<string, unknown>;
    readyToShowHandler: WindowHandler | null = null;
    show = vi.fn();
    webContents = {
      getURL: vi.fn(() => 'file:///app/index.html'),
      on: vi.fn(),
      setWindowOpenHandler: vi.fn()
    };
    on = vi.fn((event: string, handler: WindowHandler) => {
      if (event === 'closed') {
        this.closedHandler = handler;
      }
      if (event === 'ready-to-show') {
        this.readyToShowHandler = handler;
      }
      return this;
    });

    constructor(options: Record<string, unknown>) {
      this.options = options;
      windows.push(this);
    }

    static getAllWindows() {
      return windows;
    }
  }

  const state = {
    readyPromise: Promise.resolve() as Promise<void>
  };

  return {
    app: {
      getPath: vi.fn((name: string) => (name === 'downloads' ? '/Users/tester/Downloads' : '/Users/tester')),
      on: vi.fn(),
      quit: vi.fn(),
      whenReady: vi.fn(() => state.readyPromise)
    },
    BrowserWindowMock,
    ipcMain: {
      handle: vi.fn()
    },
    safeStorage: {
      decryptString: vi.fn(() => 'ak-localUserKey1234567890'),
      encryptString: vi.fn(() => Buffer.from('encrypted')),
      isEncryptionAvailable: vi.fn(() => true)
    },
    shell: {
      openExternal: vi.fn(async () => undefined),
      openPath: vi.fn(async () => '')
    },
    dialog: {
      showOpenDialog: vi.fn(async () => ({
        canceled: false,
        filePaths: ['/Volumes/Studio/YQhub']
      }))
    },
    state,
    windows
  };
});

vi.mock('electron', () => ({
  app: electronMock.app,
  BrowserWindow: electronMock.BrowserWindowMock,
  dialog: electronMock.dialog,
  ipcMain: electronMock.ipcMain,
  safeStorage: electronMock.safeStorage,
  shell: electronMock.shell
}));

vi.mock('electron-store', () => ({
  default: class StoreMock {
    private values = new Map<string, unknown>();

    constructor(options: { defaults?: Record<string, unknown> }) {
      Object.entries(options.defaults ?? {}).forEach(([key, value]) => {
        this.values.set(key, value);
      });
    }

    get(key: string) {
      return this.values.get(key);
    }

    set(key: string, value: unknown) {
      this.values.set(key, value);
    }
  }
}));

describe('Electron main process', () => {
  beforeEach(() => {
    electronMock.windows.length = 0;
    electronMock.state.readyPromise = Promise.resolve();
    vi.clearAllMocks();
  });

  it('does not use top-level await for Electron readiness', async () => {
    const source = await readFile(path.join(process.cwd(), 'electron/main.ts'), 'utf8');

    expect(source).not.toMatch(/await\s+app\.whenReady\(\)/u);
    expect(source).toMatch(/void\s+app\s*\n\s*\.whenReady\(\)/u);
  });

  it('keeps the main window referenced until it is closed', async () => {
    const main = await importMain();
    await Promise.resolve();

    expect(electronMock.windows).toHaveLength(1);
    expect(main.getMainWindowForTest()).toBe(electronMock.windows[0]);

    electronMock.windows[0].closedHandler?.();

    expect(main.getMainWindowForTest()).toBeNull();
  });

  it('shows and focuses the window after the renderer is ready', async () => {
    await importMain();
    await Promise.resolve();

    const window = electronMock.windows[0];

    expect(window.options).toMatchObject({ show: false });
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();

    window.readyToShowHandler?.();

    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
  });

  it('opens generated local videos through the operating system', async () => {
    await importMain();

    const openHandler = electronMock.ipcMain.handle.mock.calls.find(
      ([channel]) => channel === 'videos:open'
    )?.[1];

    expect(openHandler).toBeDefined();

    await openHandler?.({}, '~/Movies/YQhub/result.mp4');

    expect(electronMock.shell.openPath).toHaveBeenCalledWith(
      path.join('/Users/tester', 'Movies', 'YQhub', 'result.mp4')
    );
    expect(electronMock.shell.openExternal).not.toHaveBeenCalled();
  });

  it('registers export directory IPC handlers', async () => {
    await importMain();

    const getHandler = electronMock.ipcMain.handle.mock.calls.find(
      ([channel]) => channel === 'settings:getExportDirectory'
    )?.[1];
    const chooseHandler = electronMock.ipcMain.handle.mock.calls.find(
      ([channel]) => channel === 'settings:chooseExportDirectory'
    )?.[1];

    expect(getHandler).toBeDefined();
    expect(chooseHandler).toBeDefined();

    await expect(getHandler?.()).resolves.toBe('/Users/tester/Downloads');
    await expect(chooseHandler?.()).resolves.toBe('/Volumes/Studio/YQhub');
    await expect(getHandler?.()).resolves.toBe('/Volumes/Studio/YQhub');
    expect(electronMock.dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: ['openDirectory', 'createDirectory']
      })
    );
  });

  it('keeps external navigation out of the app window', async () => {
    await importMain();
    await Promise.resolve();

    const handler = electronMock.windows[0].webContents.setWindowOpenHandler.mock.calls[0][0];
    const result = handler({ url: 'https://example.com/generated/video.mp4' });

    expect(result).toEqual({ action: 'deny' });
    expect(electronMock.shell.openExternal).toHaveBeenCalledWith('https://example.com/generated/video.mp4');
  });
});

function importMain() {
  vi.resetModules();
  return import('./main');
}
