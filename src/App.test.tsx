import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createMemoryStorage } from './domain/persistence';

describe('App', () => {
  afterEach(() => {
    delete window.yqhub;
  });

  it('renders the local video workspace controls', () => {
    render(<App storage={createMemoryStorage()} />);

    expect(screen.getByRole('heading', { name: 'YQhub' })).toBeInTheDocument();
    expect(screen.getByLabelText('品牌栏')).toBeInTheDocument();
    expect(screen.getByLabelText('创作台')).toBeInTheDocument();
    expect(screen.getByLabelText('任务区')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '浅色' })).toBeInTheDocument();
    expect(screen.getByText('拖入素材，或选择文件')).toBeInTheDocument();
    expect(screen.getByLabelText('提示词')).toBeInTheDocument();
    expect(screen.getByLabelText('时长')).toBeInTheDocument();
    expect(screen.getByLabelText('分辨率')).toBeInTheDocument();
    expect(screen.getByLabelText('模型')).toHaveValue('seedance2.0fast');
    expect(screen.getByRole('option', { name: '约 15 秒' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '16:9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成' })).toBeInTheDocument();
    expect(screen.getByText('生成后显示进度')).toBeInTheDocument();
    expect(screen.queryByText(/公网 URL|Secret|Relay/i)).not.toBeInTheDocument();
  });

  it('toggles the workspace theme and restores it after reopening', () => {
    const storage = createMemoryStorage();
    const firstRender = render(<App storage={storage} />);

    expect(screen.getByLabelText('应用外壳')).toHaveAttribute('data-theme', 'dark');
    fireEvent.click(screen.getByRole('button', { name: '浅色' }));
    expect(screen.getByLabelText('应用外壳')).toHaveAttribute('data-theme', 'light');

    firstRender.unmount();
    render(<App storage={storage} />);

    expect(screen.getByLabelText('应用外壳')).toHaveAttribute('data-theme', 'light');
    fireEvent.click(screen.getByRole('button', { name: '深色' }));
    expect(screen.getByLabelText('应用外壳')).toHaveAttribute('data-theme', 'dark');
  });

  it('creates a task with the selected local API account', () => {
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

    const taskPanel = screen.getByLabelText('任务区');
    expect(within(taskPanel).getByText('生成一条茶饮短片')).toBeInTheDocument();
    expect(within(taskPanel).getByText('萧衍账号')).toBeInTheDocument();
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
    const addAccount = vi.fn(async () => ({
      id: 'native-account-1',
      name: '本机账号',
      apiKeyPreview: 'ak-...tive',
      apiKeyRef: 'electron-safe:native',
      relayEndpoint: 'https://relay.example.com',
      concurrencyLimit: 1,
      enabled: true,
      createdAt: '2026-06-13T00:00:00.000Z',
      updatedAt: '2026-06-13T00:00:00.000Z'
    }));
    window.yqhub = {
      listAccounts: vi.fn(async () => []),
      addAccount,
      deleteAccount: vi.fn(async () => undefined),
      submitTask: vi.fn(),
      refreshTask: vi.fn()
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
    expect(storage.getItem('yqhub-workspace:v1')).not.toContain('ak-nativeUserKey1234567890');
  });

  it('does not ask for public URLs before native submit', async () => {
    const storage = createMemoryStorage();
    window.URL.createObjectURL = vi.fn(() => 'blob:asset');
    const submitTask = vi.fn(async (task) => ({
      ...task,
      apiTaskId: 'remote-task-1',
      requestId: 'request-1'
    }));
    window.yqhub = {
      listAccounts: vi.fn(async () => [
        {
          id: 'native-account-1',
          name: '本机账号',
          apiKeyPreview: 'ak-...tive',
          apiKeyRef: 'electron-safe:native',
          relayEndpoint: 'https://relay.example.com',
          concurrencyLimit: 1,
          enabled: true,
          createdAt: '2026-06-13T00:00:00.000Z',
          updatedAt: '2026-06-13T00:00:00.000Z'
        }
      ]),
      addAccount: vi.fn(),
      deleteAccount: vi.fn(async () => undefined),
      submitTask,
      refreshTask: vi.fn()
    };

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue('native-account-1');
    });

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['fake'], 'product.png', { type: 'image/png' })]
      }
    });
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条茶饮短片' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(submitTask).toHaveBeenCalled();
    });
    expect(screen.queryByLabelText('图一公网 URL')).not.toBeInTheDocument();
  });

  it('submits a native task with local asset data for relay upload', async () => {
    const storage = createMemoryStorage();
    window.URL.createObjectURL = vi.fn(() => 'blob:asset');
    const submitTask = vi.fn(async (task) => ({
      ...task,
      apiTaskId: 'remote-task-1',
      requestId: 'request-1'
    }));
    window.yqhub = {
      listAccounts: vi.fn(async () => [
        {
          id: 'native-account-1',
          name: '本机账号',
          apiKeyPreview: 'ak-...tive',
          apiKeyRef: 'electron-safe:native',
          relayEndpoint: 'https://relay.example.com',
          concurrencyLimit: 1,
          enabled: true,
          createdAt: '2026-06-13T00:00:00.000Z',
          updatedAt: '2026-06-13T00:00:00.000Z'
        }
      ]),
      addAccount: vi.fn(),
      deleteAccount: vi.fn(async () => undefined),
      submitTask,
      refreshTask: vi.fn()
    };

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue('native-account-1');
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
          accountId: 'native-account-1',
          prompt: '生成一条茶饮短片',
          model: 'seedance2.0fast',
          assets: [
            expect.objectContaining({
              dataUrl: expect.stringMatching(/^data:image\/png;base64,/)
            })
          ]
        })
      );
    });
  });
});
