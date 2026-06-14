import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => {
  type WindowHandler = () => void;

  const windows: Array<{
    closedHandler: WindowHandler | null;
    loadFile: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    webContents: {
      getURL: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
    };
  }> = [];

  class BrowserWindowMock {
    closedHandler: WindowHandler | null = null;
    loadFile = vi.fn(async () => undefined);
    loadURL = vi.fn(async () => undefined);
    webContents = {
      getURL: vi.fn(() => 'file:///app/index.html'),
      on: vi.fn(),
      setWindowOpenHandler: vi.fn()
    };
    on = vi.fn((event: string, handler: WindowHandler) => {
      if (event === 'closed') {
        this.closedHandler = handler;
      }
      return this;
    });

    constructor() {
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
      getPath: vi.fn(() => '/Users/tester'),
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
    state,
    windows
  };
});

vi.mock('electron', () => ({
  app: electronMock.app,
  BrowserWindow: electronMock.BrowserWindowMock,
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

  it('opens generated local videos through the operating system', async () => {
    await importMain();

    const openHandler = electronMock.ipcMain.handle.mock.calls.find(
      ([channel]) => channel === 'videos:open'
    )?.[1];

    expect(openHandler).toBeDefined();

    await openHandler?.({}, '~/Movies/YQhub/result.mp4');

    expect(electronMock.shell.openPath).toHaveBeenCalledWith('/Users/tester/Movies/YQhub/result.mp4');
    expect(electronMock.shell.openExternal).not.toHaveBeenCalled();
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
