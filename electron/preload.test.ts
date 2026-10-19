import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('packaged CommonJS preload', () => {
  it('exposes the native API and forwards arguments through its actual IPC channels', async () => {
    const invoke = vi.fn(async () => 'native-result');
    const exposeInMainWorld = vi.fn();
    const source = readFileSync('electron/preload.cjs', 'utf8');

    runInNewContext(source, {
      require(name: string) {
        expect(name).toBe('electron');
        return { contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke } };
      }
    });

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [name, api] = exposeInMainWorld.mock.calls[0];
    expect(name).toBe('yqhub');

    const calls: Array<[string, string, unknown[]]> = [
      ['listAccounts', 'accounts:list', []],
      ['addAccount', 'accounts:add', [{ name: 'local', apiKey: 'test-key' }]],
      ['deleteAccount', 'accounts:delete', ['account-1']],
      ['submitTask', 'tasks:submit', [{ id: 'task-1' }]],
      ['refreshTask', 'tasks:refresh', [{ id: 'task-1' }]],
      ['openVideo', 'videos:open', ['/tmp/video.mp4']],
      ['getExportDirectory', 'settings:getExportDirectory', []],
      ['chooseExportDirectory', 'settings:chooseExportDirectory', []],
      ['showEditContextMenu', 'edit:showContextMenu', []]
    ];
    expect(Object.keys(api)).toEqual(calls.map(([method]) => method));
    for (const [method, channel, args] of calls) {
      await expect(api[method](...args)).resolves.toBe('native-result');
      expect(invoke).toHaveBeenLastCalledWith(channel, ...args);
    }
    expect(invoke).toHaveBeenCalledTimes(calls.length);
  });
});
