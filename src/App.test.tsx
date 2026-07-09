import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createMemoryStorage, WORKSPACE_STORAGE_KEY } from './domain/persistence';
import type { ApiAccount, GenerationTask, WorkspaceState } from './domain/types';
import appPackage from '../package.json';

describe('App', () => {
  afterEach(() => {
    delete window.yqhub;
  });

  it('renders the single-screen video workspace controls', () => {
    render(<App storage={createMemoryStorage()} />);

    expect(screen.getByRole('heading', { name: 'YQhub' })).toBeInTheDocument();
    expect(screen.getByText(`v${appPackage.version}`)).toBeInTheDocument();
    expect(screen.getByLabelText('视频生成工作台')).toBeInTheDocument();
    expect(screen.getByLabelText('参考素材')).toBeInTheDocument();
    expect(screen.getByLabelText('账号与保存')).toBeInTheDocument();
    expect(screen.getByLabelText('视频预览')).toBeInTheDocument();
    expect(screen.getByLabelText('历史记录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '深色' })).toBeInTheDocument();
    expect(screen.getByText('拖入或选择')).toBeInTheDocument();
    expect(screen.getByLabelText('提示词')).toBeInTheDocument();
    expect(screen.getByLabelText('时长')).toHaveValue('15');
    expect(screen.getByLabelText('清晰度')).toHaveValue('720p');
    expect(screen.getByLabelText('画幅')).toHaveValue('9:16');
    expect(screen.getByLabelText('模型')).toHaveValue('Seedance_2.0_mini');
    expect(screen.getByRole('option', { name: 'Seedance 2.0 Fast' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('清晰度')).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '生成' })).toBeInTheDocument();
    expect(screen.getByText('本地记录')).toBeInTheDocument();
    expect(screen.queryByLabelText('素材与账号')).not.toBeInTheDocument();
    expect(screen.queryByText('本机缓存')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('参考素材')).queryByLabelText('API Key')).not.toBeInTheDocument();
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
    expect(within(screen.getByLabelText('当前任务')).queryByText('生成一条茶饮短片')).not.toBeInTheDocument();
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
    window.yqhub = createNativeApiMock({
      addAccount,
    });

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

  it('deletes the current native account and selects the next saved account', async () => {
    const storage = createMemoryStorage();
    const firstAccount = createNativeAccount({ id: 'native-account-1', name: '账号一' });
    const secondAccount = createNativeAccount({ id: 'native-account-2', name: '账号二' });
    const deleteAccount = vi.fn(async () => undefined);
    window.yqhub = createNativeApiMock({
      accounts: [firstAccount, secondAccount],
      deleteAccount
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(firstAccount.id);
    });
    fireEvent.click(within(screen.getByLabelText('账号与保存')).getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledWith(firstAccount.id);
    });
    expect(screen.getByLabelText('当前账号')).toHaveValue(secondAccount.id);
    expect(within(screen.getByLabelText('当前账号')).queryByRole('option', { name: '账号一' })).not.toBeInTheDocument();
    expect(screen.getByText('账号已删除')).toBeInTheDocument();
  });

  it('submits a native task with local asset data and no public URL field', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const submitTask = vi.fn(async (task) => ({
      ...task,
      apiTaskId: 'remote-task-1',
      requestId: 'request-1'
    }));
    window.yqhub = createNativeApiMock({
      accounts: [account],
      submitTask,
    });

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
          model: 'Seedance_2.0_mini',
          duration: '15',
          resolution: '720p',
          ratio: '9:16',
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

  it('uses the uploaded file name as the default asset remark', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const submitTask = vi.fn(async (task) => ({
      ...task,
      apiTaskId: 'remote-task-1',
      requestId: 'request-1'
    }));
    window.yqhub = createNativeApiMock({
      accounts: [account],
      submitTask,
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['fake'], '商业楼外景.png', { type: 'image/png' })]
      }
    });

    expect(await screen.findByDisplayValue('商业楼外景')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条短片' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(submitTask).toHaveBeenCalledWith(
        expect.objectContaining({
          finalPrompt: '图一是商业楼外景。生成一条短片',
          assets: [
            expect.objectContaining({
              label: '商业楼外景',
              localName: '商业楼外景.png'
            })
          ]
        })
      );
    });
  });

  it('submits local video references through the native client', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const submitTask = vi.fn(async (task) => ({
      ...task,
      apiTaskId: 'remote-video-task-1',
      requestId: 'request-video-1'
    }));
    window.yqhub = createNativeApiMock({
      accounts: [account],
      submitTask,
    });

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

  it('submits the custom output name with a native task', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const submitTask = vi.fn(async (task) => ({
      ...task,
      apiTaskId: 'remote-named-task-1',
      requestId: 'request-named-1'
    }));
    window.yqhub = createNativeApiMock({
      accounts: [account],
      submitTask,
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);
    });
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条茶饮短片' }
    });
    fireEvent.change(screen.getByLabelText('文件名'), {
      target: { value: '茶饮上市-横版开场' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(submitTask).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '生成一条茶饮短片',
          outputName: '茶饮上市-横版开场'
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
    window.yqhub = createNativeApiMock({
      accounts: [account],
      submitTask,
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);
    });
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条茶饮短片' }
    });
    const beforeSubmit = Date.now() - 1000;
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(within(screen.getByLabelText('当前任务')).getByText('失败')).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText('当前任务')).getByText('小云雀接口请求失败')).toBeInTheDocument();
    await waitFor(() => {
      const savedState = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '{}') as WorkspaceState;
      expect(Date.parse(savedState.tasks[0].updatedAt)).toBeGreaterThanOrEqual(beforeSubmit);
    });
    expect(submitTask).toHaveBeenCalledTimes(1);
  });

  it('shows a clean network error when Electron wraps a fetch failure', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const submitTask = vi.fn(async () => {
      throw new Error("Error invoking remote method 'tasks:submit': TypeError: fetch failed");
    });
    window.yqhub = createNativeApiMock({
      accounts: [account],
      submitTask,
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);
    });
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条茶饮短片' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(within(screen.getByLabelText('当前任务')).getByText('失败')).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText('当前任务')).getByText('网络连接失败，请稍后重试')).toBeInTheDocument();
    expect(screen.queryByText(/Error invoking remote method|TypeError: fetch failed/u)).not.toBeInTheDocument();
  });

  it('shows a short cloud sync error and copies the detailed log when clicked', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const detailedError =
      "Error invoking remote method 'tasks:submit': Error: 同步到云空间失败 log_id=20260620172159F2E6F9589C7D9B3FE3B";
    const writeText = vi.fn(async () => undefined);
    const submitTask = vi.fn(async () => {
      throw new Error(detailedError);
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText
      }
    });
    window.yqhub = createNativeApiMock({
      accounts: [account],
      submitTask,
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);
    });
    fireEvent.change(screen.getByLabelText('提示词'), {
      target: { value: '生成一条茶饮短片' }
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(within(screen.getByLabelText('当前任务')).getByText('失败')).toBeInTheDocument();
    });
    const currentPanel = screen.getByLabelText('当前任务');
    const previewPanel = screen.getByLabelText('视频预览');
    const copyButton = within(currentPanel).getByRole('button', { name: '复制详细错误' });

    expect(copyButton).toHaveTextContent('素材同步失败，请稍后重试');
    expect(within(previewPanel).getByRole('button', { name: '复制详细错误' })).toHaveTextContent(
      '素材同步失败，请稍后重试'
    );
    expect(within(currentPanel).queryByText(/log_id/u)).not.toBeInTheDocument();
    expect(within(previewPanel).queryByText(/log_id/u)).not.toBeInTheDocument();

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('同步到云空间失败 log_id=20260620172159F2E6F9589C7D9B3FE3B');
    });
    expect(screen.getByText('已复制错误')).toBeInTheDocument();
  });

  it('queues a second native submit until one minute after the previous submit', async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const account = createNativeAccount();
      const submitTask = vi.fn(async (task: GenerationTask) => ({
        ...task,
        apiTaskId: `remote-${task.id}`,
        requestId: `request-${task.id}`
      }));
      window.yqhub = createNativeApiMock({
        accounts: [account],
        refreshTask: vi.fn(async (task) => task),
        submitTask,
      });

      render(<App storage={storage} />);

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByLabelText('当前账号')).toHaveValue(account.id);

      fireEvent.change(screen.getByLabelText('提示词'), {
        target: { value: '第一条视频' }
      });
      fireEvent.click(screen.getByRole('button', { name: '生成' }));

      await act(async () => {
        await Promise.resolve();
      });
      expect(submitTask).toHaveBeenCalledTimes(1);

      fireEvent.change(screen.getByLabelText('提示词'), {
        target: { value: '第二条视频' }
      });
      fireEvent.click(screen.getByRole('button', { name: '生成' }));

      expect(submitTask).toHaveBeenCalledTimes(1);
      expect(screen.getByText('等待 60 秒提交')).toBeInTheDocument();
      expect(within(screen.getByLabelText('当前任务')).getByText('等待提交')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(59_999);
        await Promise.resolve();
      });
      expect(submitTask).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });

      expect(submitTask).toHaveBeenCalledTimes(2);
      expect(submitTask.mock.calls[1][0]).toMatchObject({
        prompt: '第二条视频',
        model: 'Seedance_2.0_mini',
        status: 'in_queue'
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not create a duplicate active task for the same native draft', async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const account = createNativeAccount();
      const submitTask = vi.fn(async (task: GenerationTask) => ({
        ...task,
        apiTaskId: `remote-${task.id}`,
        requestId: `request-${task.id}`
      }));
      window.yqhub = createNativeApiMock({
        accounts: [account],
        refreshTask: vi.fn(async (task) => task),
        submitTask,
      });

      render(<App storage={storage} />);

      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.change(screen.getByLabelText('提示词'), {
        target: { value: '电影级镜头。末国一目与小未抵达商业楼。' }
      });
      fireEvent.click(screen.getByRole('button', { name: '生成' }));

      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.click(screen.getByRole('button', { name: '生成' }));

      const currentPanel = screen.getByLabelText('当前任务');
      expect(submitTask).toHaveBeenCalledTimes(1);
      expect(currentPanel.querySelectorAll('.task-item')).toHaveLength(1);
      expect(screen.getByText('相同任务已在生成')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });
      expect(submitTask).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not rate limit submits from different native accounts', async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const firstAccount = createNativeAccount({ id: 'native-account-1', name: '账号一' });
      const secondAccount = createNativeAccount({ id: 'native-account-2', name: '账号二' });
      const submitTask = vi.fn(async (task: GenerationTask) => ({
        ...task,
        apiTaskId: `remote-${task.id}`,
        requestId: `request-${task.id}`
      }));
      window.yqhub = createNativeApiMock({
        accounts: [firstAccount, secondAccount],
        refreshTask: vi.fn(async (task) => task),
        submitTask,
      });

      render(<App storage={storage} />);

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByLabelText('当前账号')).toHaveValue(firstAccount.id);

      fireEvent.change(screen.getByLabelText('提示词'), {
        target: { value: '第一账号视频' }
      });
      fireEvent.click(screen.getByRole('button', { name: '生成' }));

      await act(async () => {
        await Promise.resolve();
      });
      expect(submitTask).toHaveBeenCalledTimes(1);

      fireEvent.change(screen.getByLabelText('当前账号'), {
        target: { value: secondAccount.id }
      });
      fireEvent.change(screen.getByLabelText('提示词'), {
        target: { value: '第二账号视频' }
      });
      fireEvent.click(screen.getByRole('button', { name: '生成' }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(submitTask).toHaveBeenCalledTimes(2);
      expect(submitTask.mock.calls[0][0]).toMatchObject({
        accountId: firstAccount.id,
        prompt: '第一账号视频'
      });
      expect(submitTask.mock.calls[1][0]).toMatchObject({
        accountId: secondAccount.id,
        prompt: '第二账号视频'
      });
      expect(screen.queryByText('等待 60 秒提交')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks a native task failed when polling fails', async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const account = createNativeAccount();
      storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(createPollingWorkspace(account)));
      window.yqhub = createNativeApiMock({
        accounts: [account],
        refreshTask: vi.fn(async () => {
          throw new Error('查询失败');
        })
      });

      render(<App storage={storage} />);

      await act(async () => {
        await Promise.resolve();
        vi.advanceTimersByTime(3500);
      });

      expect(within(screen.getByLabelText('当前任务')).getByText('失败')).toBeInTheDocument();
      expect(within(screen.getByLabelText('当前任务')).getByText('查询失败')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start another native refresh while the same task is still refreshing', async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const account = createNativeAccount();
      storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(createPollingWorkspace(account)));
      let resolveRefresh: ((task: GenerationTask) => void) | null = null;
      const refreshTask = vi.fn(
        async (task: GenerationTask) =>
          new Promise<GenerationTask>((resolve) => {
            resolveRefresh = resolve;
          })
      );
      window.yqhub = createNativeApiMock({
        accounts: [account],
        refreshTask
      });

      render(<App storage={storage} />);

      await act(async () => {
        await Promise.resolve();
        vi.advanceTimersByTime(3500);
      });
      expect(refreshTask).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(3500);
        await Promise.resolve();
      });
      expect(refreshTask).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveRefresh?.({
          ...createPollingWorkspace(account).tasks[0],
          progress: 80
        });
        await Promise.resolve();
      });
      await act(async () => {
        vi.advanceTimersByTime(3500);
        await Promise.resolve();
      });
      expect(refreshTask).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the current task compact with a shortened prompt', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const longPrompt = '心脏模型由红白3D打印材料融合组成参考图，过程丝滑，英雄镜头，需要体现非常长的镜头描述和材质变化';
    storage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(createPollingWorkspace(account, { prompt: longPrompt }))
    );
    window.yqhub = createNativeApiMock({
      accounts: [account]
    });

    render(<App storage={storage} />);

    const currentPanel = screen.getByLabelText('当前任务');

    await waitFor(() => {
      expect(within(currentPanel).getByTitle(longPrompt)).toBeInTheDocument();
    });
    expect(within(currentPanel).queryByText(longPrompt)).not.toBeInTheDocument();
    expect(within(currentPanel).getByText('心脏模型由红白3D打印材料融合组成参考图，过程丝滑，英雄镜头...')).toBeInTheDocument();
  });

  it('plays completed local videos with visible custom progress controls', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(function mockPlay(this: HTMLMediaElement) {
        Object.defineProperty(this, 'paused', { value: false, configurable: true });
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      });
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(function mockPause(this: HTMLMediaElement) {
        Object.defineProperty(this, 'paused', { value: true, configurable: true });
        this.dispatchEvent(new Event('pause'));
      });
    storage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(createCompletedWorkspace(account, '/Users/tester/Movies/YQhub/result.mp4'))
    );
    window.yqhub = createNativeApiMock({
      accounts: [account]
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getAllByText('生成一条茶饮短片').length).toBeGreaterThan(0);
    });

    const preview = screen.getByLabelText('视频预览');
    const video = within(preview).getByLabelText('本地视频预览') as HTMLVideoElement;
    const seek = within(preview).getByLabelText('视频进度') as HTMLInputElement;

    expect(video).not.toHaveAttribute('controls');
    expect(video.getAttribute('src')).toContain('file:///Users/tester/Movies/YQhub/result.mp4');
    expect(within(preview).getByRole('button', { name: '播放' })).toBeInTheDocument();
    expect(seek).toBeInTheDocument();

    fireEvent.click(within(preview).getByRole('button', { name: '播放或暂停视频' }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    fireEvent.click(within(preview).getByRole('button', { name: '播放或暂停视频' }));
    expect(pause).toHaveBeenCalledTimes(1);

    Object.defineProperty(video, 'duration', { configurable: true, value: 5.1 });
    Object.defineProperty(video, 'ended', { configurable: true, value: true });
    video.currentTime = 3.9;
    fireEvent.pause(video);
    expect(seek.value).toBe('5.1');

    fireEvent.ended(video);
    expect(seek.value).toBe('5.1');

    Object.defineProperty(video, 'paused', { configurable: true, value: true });
    video.currentTime = 5;
    fireEvent.click(within(preview).getByRole('button', { name: '播放或暂停视频' }));

    expect(video.currentTime).toBe(0);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));

    play.mockRestore();
    pause.mockRestore();
  });

  it('uses the task ratio for non-vertical previews and encodes Windows paths', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    storage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(
        createCompletedWorkspace(account, 'C:\\Users\\tester\\Videos\\wide result.mp4', {
          ratio: '16:9'
        })
      )
    );
    window.yqhub = createNativeApiMock({
      accounts: [account]
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getAllByText('生成一条茶饮短片').length).toBeGreaterThan(0);
    });

    const preview = screen.getByLabelText('视频预览');
    const stage = preview.querySelector<HTMLElement>('.preview-stage');
    const previewVideo = within(preview).getByLabelText('本地视频预览');
    const historyVideo = screen
      .getByLabelText('历史记录')
      .querySelector<HTMLVideoElement>('.history-thumb-button video');

    expect(stage?.style.getPropertyValue('--preview-aspect')).toBe('16 / 9');
    expect(previewVideo.getAttribute('src')).toBe('file:///C:/Users/tester/Videos/wide%20result.mp4');
    expect(historyVideo?.getAttribute('src')).toBe('file:///C:/Users/tester/Videos/wide%20result.mp4');
  });

  it('opens the native edit menu from the prompt context menu', async () => {
    const showEditContextMenu = vi.fn(async () => undefined);
    window.yqhub = createNativeApiMock({
      showEditContextMenu
    });

    render(<App storage={createMemoryStorage()} />);

    fireEvent.contextMenu(screen.getByLabelText('提示词'));

    expect(showEditContextMenu).toHaveBeenCalledTimes(1);
  });

  it('accepts dropped files across the whole reference asset panel', async () => {
    render(<App storage={createMemoryStorage()} />);

    fireEvent.drop(screen.getByLabelText('参考素材'), {
      dataTransfer: {
        files: [new File(['fake'], 'product.png', { type: 'image/png' })]
      }
    });

    await screen.findByText('图一');
    expect(screen.getByText('继续添加').closest('.asset-dropzone')).toHaveClass('is-compact');
  });

  it('opens image assets in a larger preview and compacts the upload area after assets exist', async () => {
    render(<App storage={createMemoryStorage()} />);

    const dropzone = screen.getByText('拖入或选择').closest('.asset-dropzone');
    expect(dropzone).not.toHaveClass('is-compact');

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(['fake'], 'heart.png', { type: 'image/png' })]
      }
    });

    await screen.findByText('图一');
    expect(screen.getByText('继续添加').closest('.asset-dropzone')).toHaveClass('is-compact');

    fireEvent.click(screen.getByRole('button', { name: '放大预览 图一' }));

    expect(screen.getByRole('dialog', { name: '素材预览' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'heart.png' })).toBeInTheDocument();

    const backdrop = document.querySelector('.asset-preview-backdrop')!;
    expect(backdrop.parentElement).toBe(document.body);

    fireEvent.mouseDown(backdrop);

    expect(screen.queryByRole('dialog', { name: '素材预览' })).not.toBeInTheDocument();
  });

  it('opens completed videos through the native bridge instead of navigating the app window', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const openVideo = vi.fn(async () => undefined);
    storage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(createCompletedWorkspace(account, '/Users/tester/Movies/YQhub/result.mp4'))
    );
    window.yqhub = createNativeApiMock({
      accounts: [account],
      openVideo
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getAllByText('生成一条茶饮短片').length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('link', { name: /生成一条茶饮短片/u })).not.toBeInTheDocument();

    const historyPanel = screen.getByLabelText('历史记录');
    fireEvent.click(within(historyPanel).getByRole('button', { name: /生成一条茶饮短片/u }));

    expect(openVideo).toHaveBeenCalledWith('/Users/tester/Movies/YQhub/result.mp4');
  });

  it('reuses a completed history item in the current draft', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    storage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        ...createCompletedWorkspace(account, '/Users/tester/Movies/YQhub/result.mp4'),
        draft: {
          prompt: '',
          assets: [],
          duration: '5',
          resolution: '720p',
          ratio: '16:9',
          model: 'Seedance_2.0_mini',
          outputName: ''
        },
        tasks: [
          {
            ...createCompletedWorkspace(account, '/Users/tester/Movies/YQhub/result.mp4').tasks[0],
            prompt: '复用这条历史提示词',
            finalPrompt: '复用这条历史提示词\n\n图一是产品正面',
            assets: [
              {
                id: 'asset-history-1',
                type: 'image',
                label: '图一是产品正面',
                localName: 'product.png',
                previewUrl: 'data:image/png;base64,ZmFrZQ==',
                dataUrl: 'data:image/png;base64,ZmFrZQ==',
                mimeType: 'image/png',
                uploadStatus: 'local'
              }
            ],
            duration: '10',
            resolution: '480p',
            ratio: '9:16'
          }
        ]
      } satisfies WorkspaceState)
    );
    window.yqhub = createNativeApiMock({
      accounts: [account]
    });

    render(<App storage={storage} />);

    await waitFor(() => {
      expect(screen.getByText('复用这条历史提示词')).toBeInTheDocument();
    });
    fireEvent.click(within(screen.getByLabelText('历史记录')).getByRole('button', { name: '复用' }));

    expect(screen.getByLabelText('提示词')).toHaveValue('复用这条历史提示词');
    expect(screen.getByLabelText('时长')).toHaveValue('10');
    expect(screen.getByLabelText('清晰度')).toHaveValue('720p');
    expect(screen.getByLabelText('画幅')).toHaveValue('9:16');
    expect(screen.getByDisplayValue('图一是产品正面')).toBeInTheDocument();
  });

  it('loads and changes the export directory through the native bridge', async () => {
    const storage = createMemoryStorage();
    const account = createNativeAccount();
    const chooseExportDirectory = vi.fn(async () => '/Volumes/Studio/YQhub');
    window.yqhub = createNativeApiMock({
      accounts: [account],
      exportDirectory: '/Users/tester/Movies/YQhub/exports',
      chooseExportDirectory
    });

    render(<App storage={storage} />);

    await screen.findByText('/Users/tester/Movies/YQhub/exports');
    fireEvent.click(screen.getByRole('button', { name: '更改' }));

    await screen.findByText('/Volumes/Studio/YQhub');
    expect(chooseExportDirectory).toHaveBeenCalledTimes(1);
  });
});

function createNativeApiMock({
  accounts = [],
  addAccount = vi.fn(),
  deleteAccount = vi.fn(async () => undefined),
  chooseExportDirectory = vi.fn(async () => '/Users/tester/Movies/YQhub/exports'),
  exportDirectory = '/Users/tester/Movies/YQhub/exports',
  openVideo = vi.fn(async () => undefined),
  refreshTask = vi.fn(),
  showEditContextMenu = vi.fn(async () => undefined),
  submitTask = vi.fn()
}: {
  accounts?: ApiAccount[];
  addAccount?: ReturnType<typeof vi.fn>;
  deleteAccount?: ReturnType<typeof vi.fn>;
  chooseExportDirectory?: ReturnType<typeof vi.fn>;
  exportDirectory?: string;
  openVideo?: ReturnType<typeof vi.fn>;
  refreshTask?: ReturnType<typeof vi.fn>;
  showEditContextMenu?: ReturnType<typeof vi.fn>;
  submitTask?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    listAccounts: vi.fn(async () => accounts),
    addAccount,
    deleteAccount,
    submitTask,
    refreshTask,
    openVideo,
    getExportDirectory: vi.fn(async () => exportDirectory),
    chooseExportDirectory,
    showEditContextMenu
  } as unknown as typeof window.yqhub;
}

function createNativeAccount(overrides: Partial<ApiAccount> = {}): ApiAccount {
  return {
    id: 'native-account-1',
    name: '本机账号',
    apiKeyPreview: 'ak-...tive',
    apiKeyRef: 'electron-safe:native',
    concurrencyLimit: 1,
    enabled: true,
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z',
    ...overrides
  };
}

function createCompletedWorkspace(
  account: ApiAccount,
  localVideoPath: string,
  overrides: Partial<GenerationTask> = {}
): WorkspaceState {
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
      model: 'Seedance_2.0_mini',
      outputName: ''
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
        model: 'Seedance_2.0_mini',
        status: 'done',
        progress: 100,
        etaSeconds: 0,
        apiTaskId: 'remote-task-1',
        videoUrl: 'https://example.com/generated/remote-task-1.mp4',
        localVideoPath,
        outputName: '生成一条茶饮短片',
        errorCode: null,
        errorMessage: null,
        requestId: 'request-1',
        createdAt: '2026-06-13T00:00:00.000Z',
        updatedAt: '2026-06-13T00:00:00.000Z',
        ...overrides
      }
    ]
  };
}

function createPollingWorkspace(account: ApiAccount, overrides: Partial<GenerationTask> = {}): WorkspaceState {
  return {
    ...createCompletedWorkspace(account, ''),
    tasks: [
      {
        ...createCompletedWorkspace(account, '').tasks[0],
        status: 'generating',
        progress: 72,
        etaSeconds: 48,
        videoUrl: null,
        localVideoPath: null,
        ...overrides
      }
    ]
  };
}
