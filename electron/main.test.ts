import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => {
  type WindowHandler = () => void;

  const windows: Array<{
    closedHandler: WindowHandler | null;
    loadFile: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  }> = [];

  class BrowserWindowMock {
    closedHandler: WindowHandler | null = null;
    loadFile = vi.fn(async () => undefined);
    loadURL = vi.fn(async () => undefined);
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
    state,
    windows
  };
});

vi.mock('electron', () => ({
  app: electronMock.app,
  BrowserWindow: electronMock.BrowserWindowMock,
  ipcMain: electronMock.ipcMain,
  safeStorage: electronMock.safeStorage
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

  it('does not block module evaluation while waiting for Electron readiness', async () => {
    electronMock.state.readyPromise = new Promise(() => undefined);

    const result = await Promise.race([
      importMain().then(() => 'resolved'),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve('timeout'), 50);
      })
    ]);

    expect(result).toBe('resolved');
    expect(electronMock.windows).toHaveLength(0);
  });

  it('keeps the main window referenced until it is closed', async () => {
    const main = await importMain();
    await Promise.resolve();

    expect(electronMock.windows).toHaveLength(1);
    expect(main.getMainWindowForTest()).toBe(electronMock.windows[0]);

    electronMock.windows[0].closedHandler?.();

    expect(main.getMainWindowForTest()).toBeNull();
  });
});

function importMain() {
  vi.resetModules();
  return import('./main');
}
