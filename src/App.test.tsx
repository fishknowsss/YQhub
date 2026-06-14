import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createMemoryStorage, WORKSPACE_STORAGE_KEY } from './domain/persistence';
import type { ApiAccount, WorkspaceState } from './domain/types';

describe('App', () => {
  afterEach(() => {
    delete window.yqhub;
  });

  it('renders the single-screen video workspace controls', () => {
    render(<App storage={createMemoryStorage()} />);

    expect(screen.getByRole('heading', { name: 'YQhub' })).toBeInTheDocument();
    expect(screen.getByLabelText('视频生成工作台')).toBeInTheDocument();
    expect(screen.getByLabelText('素材与账号')).toBeInTheDocument();
    expect(screen.getByLabelText('创作台')).toBeInTheDocument();
    expect(screen.getByLabelText('任务区')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '深色' })).toBeInTheDocument();
    expect(screen.getByText('拖入或选择')).toBeInTheDocument();
    expect(screen.getByLabelText('提示词')).toBeInTheDocument();
    expect(screen.getByLabelText('时长')).toHaveValue('5');
    expect(screen.getByLabelText('清晰度')).toHaveValue('720p');
    expect(screen.getByLabelText('画幅')).toHaveValue('16:9');
    expect(screen.getByLabelText('模型')).toHaveValue('seedance2.0fast');
    expect(screen.getByRole('button', { name: '生成' })).toBeInTheDocument();
    expect(screen.getByText('生成后显示进度')).toBeInTheDocument();
    expect(screen.queryByText(/公网 URL|Secret/i)).not.toBeInTheDocument();
    expect(document.querySelector('.brand-mark')).not.toBeInTheDocument();
  });

  it('toggles the workspace theme and restores it after reopening', () => {
    const storage = createMemoryStorage();
    const firstRender = render(<App storage={storage} />);

    expect(screen.getByLabelText('应用外壳')).toHaveAttribute('data-theme', 'light');
    fireEvent.click(screen.getByRole('button', { name: '深色' }));
    expect(screen.getByLabelText('应用外壳')).toHaveAttribute('data-theme', 'dark');

    firstRender.unmount();
    render(<App storage={storage} />);

    expect(screen.getByLabelText('应用外壳')).toHaveAttribute('data-theme', 'dark');
    fireEvent.click(screen.getByRole('button', { name: '浅色' }));
    expect(screen.getByLabelText('应用外壳')).toHaveAttribute('data-theme', 'light');
  });

  it('keeps browser preview from creating fake generation results', () => {
    render(<App storage={createMemoryStorage()} />);

    fireEvent.change(screen.getByLabelText('账号名'), {
      target: { value: '萧衍账号' }
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'ak-xiaoUserKey1234567890' }
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条茶饮短片' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    expect(screen.getByText('请打开桌面端生成')).toBeInTheDocument();
    expect(within(screen.getByLabelText('任务区')).queryByText('生成一条茶饮短片')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('example.com');
  });

  it('rejects API keys that are not Xiaoyunque ak keys', () => {
    render(<App storage={createMemoryStorage()} />);

    fireEvent.change(screen.getByLabelText('账号名'), {
      target: { value: '错误账号' }
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-not-from-xiaoyunque' }
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(screen.getByText('只支持小云雀官网发放的 ak- API Key')).toBeInTheDocument();
    expect(screen.getByLabelText('当前账号')).toHaveValue('');
  });

  it('keeps short ak keys out of the account list', () => {
    render(<App storage={createMemoryStorage()} />);

    fireEvent.change(screen.getByLabelText('账号名'), {
      target: { value: '短 Key' }
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'ak-short' }
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(screen.getByText('只支持小云雀官网发放的 ak- API Key')).toBeInTheDocument();
    expect(screen.getByLabelText('当前账号')).toHaveValue('');
  });

  it('restores the last draft after reopening', async () => {
    const storage = createMemoryStorage();
    const firstRender = render(<App storage={storage} />);

    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '刷新后仍然保留这段提示词' }
    });

    await waitFor(() => {
      expect(screen.getByText('已保存')).toBeInTheDocument();
    });

    firstRender.unmount();
    render(<App storage={storage} />);

    expect(screen.getByLabelText('提示词')).toHaveValue('刷新后仍然保留这段提示词');
  });

  it('uses the native account API in Electron without persisting the raw key in renderer storage', async () => {
    const storage = createMemoryStorage();
    const addAccount = vi.fn(async () => createNativeAccount());
    window.yqhub = {
      listAccounts: vi.fn(async () => []),
      addAccount,
      deleteAccount: vi.fn(async () => undefined),
      submitTask: vi.fn(),
      refreshTask: vi.fn(),
      openVideo: vi.fn(async () => undefined)
    };

    render(<App storage={storage} />);

    fireEvent.change(screen.getByLabelText('账号名'), {
      target: { value: '本机账号' }
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'ak-nativeUserKey1234567890' }
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue('native-account-1');
    });
    expect(addAccount).toHaveBeenCalledWith({
      name: '本机账号',
      apiKey: 'ak-nativeUserKey1234567890'
    });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).not.toContain('ak-nativeUserKey1234567890');
  });

  it('submits a native task with local asset data and no public URL field', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const submitTask = vi.fn(async (task) => ({
      ...task,
      apiTaskId: 'remote-task-1',
      requestId: 'request-1'
    }));
    window.yqhub = {
      listAccounts: vi.fn(async () => [account]),
      addAccount: vi.fn(),
      deleteAccount: vi.fn(async () => undefined),
      submitTask,
      refreshTask: vi.fn(),
      openVideo: vi.fn(async () => undefined)
    };

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['fake'], 'product.png', { type: 'image/png' })]
      }
    });
    await screen.findByText('图一');
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条茶饮短片' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(submitTask).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: account.id,
          prompt: '生成一条茶饮短片',
          model: 'seedance2.0fast',
          resolution: '720p',
          ratio: '16:9',
          assets: [
            expect.objectContaining({
              dataUrl: expect.stringMatching(/^data:image\/png;base64,/)
            })
          ]
        })
      );
    });
    expect(screen.queryByLabelText('图一公网 URL')).not.toBeInTheDocument();
  });

  it('submits local video references through the native client', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const submitTask = vi.fn(async (task) => ({
      ...task,
      apiTaskId: 'remote-video-task-1',
      requestId: 'request-video-1'
    }));
    window.yqhub = {
      listAccounts: vi.fn(async () => [account]),
      addAccount: vi.fn(),
      deleteAccount: vi.fn(async () => undefined),
      submitTask,
      refreshTask: vi.fn(),
      openVideo: vi.fn(async () => undefined)
    };

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['fake'], 'motion.mp4', { type: 'video/mp4' })]
      }
    });
    await screen.findByText('视频一');
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '参考动作生成视频' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(submitTask).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '参考动作生成视频',
          assets: [
            expect.objectContaining({
              type: 'video',
              localName: 'motion.mp4',
              dataUrl: expect.stringMatching(/^data:video\/mp4;base64,/)
            })
          ]
        })
      );
    });
  });

  it('marks a native task failed when remote submit fails', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const submitTask = vi.fn(async () => {
      throw new Error('小云雀接口请求失败');
    });
    window.yqhub = {
      listAccounts: vi.fn(async () => [account]),
      addAccount: vi.fn(),
      deleteAccount: vi.fn(async () => undefined),
      submitTask,
      refreshTask: vi.fn(),
      openVideo: vi.fn(async () => undefined)
    } as typeof window.yqhub;

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);
    });
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条茶饮短片' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(screen.getByText('失败')).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText('任务区')).getByText('小云雀接口请求失败')).toBeInTheDocument();
    expect(submitTask).toHaveBeenCalledTimes(1);
  });

  it('marks a native task failed when polling fails', async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const account = createNativeAccount();
      storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(createPollingWorkspace(account)));
      window.yqhub = {
        listAccounts: vi.fn(async () => [account]),
        addAccount: vi.fn(),
        deleteAccount: vi.fn(async () => undefined),
        submitTask: vi.fn(),
        refreshTask: vi.fn(async () => {
          throw new Error('查询失败');
        }),
        openVideo: vi.fn(async () => undefined)
      } as typeof window.yqhub;

      render(<App storage={storage} />);

      await act(async () => {
        await Promise.resolve();
        vi.advanceTimersByTime(3500);
      });

      expect(screen.getByText('失败')).toBeInTheDocument();
      expect(within(screen.getByLabelText('任务区')).getByText('查询失败')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens completed videos through the native bridge instead of navigating the app window', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const openVideo = vi.fn(async () => undefined);
    storage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(createCompletedWorkspace(account, '/Users/tester/Movies/YQhub/result.mp4'))
    );
    window.yqhub = {
      listAccounts: vi.fn(async () => [account]),
      addAccount: vi.fn(),
      deleteAccount: vi.fn(async () => undefined),
      submitTask: vi.fn(),
      refreshTask: vi.fn(),
      openVideo
    } as typeof window.yqhub;

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getAllByText('生成一条茶饮短片').length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('link', { name: /生成一条茶饮短片/u })).not.toBeInTheDocument();

    const historyPanel = screen.getByText('历史').closest('section')!;
    fireEvent.click(within(historyPanel).getByRole('button', { name: /生成一条茶饮短片/u }));

    expect(openVideo).toHaveBeenCalledWith('/Users/tester/Movies/YQhub/result.mp4');
  });
});

function createNativeAccount(): ApiAccount {
  return {
    id: 'native-account-1',
    name: '本机账号',
    apiKeyPreview: 'ak-...tive',
    apiKeyRef: 'electron-safe:native',
    concurrencyLimit: 1,
    enabled: true,
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z'
  };
}

function createCompletedWorkspace(account: ApiAccount, localVideoPath: string): WorkspaceState {
  return {
    version: 1,
    accounts: [account],
    currentAccountId: account.id,
    draft: {
      prompt: '',
      assets: [],
      duration: '5',
      resolution: '720p',
      ratio: '16:9',
      model: 'seedance2.0fast'
    },
    tasks: [
      {
        id: 'local-task-1',
        accountId: account.id,
        prompt: '生成一条茶饮短片',
        finalPrompt: '生成一条茶饮短片',
        assets: [],
        duration: '5',
        resolution: '720p',
        ratio: '16:9',
        model: 'seedance2.0fast',
        status: 'done',
        progress: 100,
        etaSeconds: 0,
        apiTaskId: 'remote-task-1',
        videoUrl: 'https://example.com/generated/remote-task-1.mp4',
        localVideoPath,
        errorCode: null,
        errorMessage: null,
        requestId: 'request-1',
        createdAt: '2026-06-13T00:00:00.000Z',
        updatedAt: '2026-06-13T00:00:00.000Z'
      }
    ]
  };
}

function createPollingWorkspace(account: ApiAccount): WorkspaceState {
  return {
    ...createCompletedWorkspace(account, ''),
    tasks: [
      {
        ...createCompletedWorkspace(account, '').tasks[0],
        status: 'generating',
        progress: 72,
        etaSeconds: 48,
        videoUrl: null,
        localVideoPath: null
      }
    ]
  };
}
