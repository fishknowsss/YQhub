import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createMemoryStorage } from './domain/persistence';

describe('App', () => {
  afterEach(() => {
    delete window.yqLocal;
  });

  it('renders the local video workspace controls', () => {
    render(<App storage={createMemoryStorage()} />);

    expect(screen.getByRole('heading', { name: '小云雀本地生成端' })).toBeInTheDocument();
    expect(screen.getByText('拖入素材，或粘贴图片')).toBeInTheDocument();
    expect(screen.getByLabelText('提示词')).toBeInTheDocument();
    expect(screen.getByLabelText('时长')).toBeInTheDocument();
    expect(screen.getByLabelText('分辨率')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '4 秒' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '16:9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成' })).toBeInTheDocument();
    expect(screen.getByText('生成后会显示进度')).toBeInTheDocument();
  });

  it('creates a task with the selected local API account', () => {
    render(<App storage={createMemoryStorage()} />);

    fireEvent.change(screen.getByLabelText('账号名'), {
      target: { value: '萧衍账号' }
    });
    fireEvent.change(screen.getByLabelText('Access Key'), {
      target: { value: 'ak-xiao' }
    });
    fireEvent.change(screen.getByLabelText('Secret Key'), {
      target: { value: 'secret-xiao' }
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

  it('uses the native account API in Electron without persisting the raw secret in renderer storage', async () => {
    const storage = createMemoryStorage();
    const addAccount = vi.fn(async () => ({
      id: 'native-account-1',
      name: '本机账号',
      accessKeyId: 'ak-native',
      secretAccessKeyRef: 'electron-safe:native',
      endpoint: 'https://visual.volcengineapi.com',
      region: 'cn-north-1',
      service: 'cv',
      concurrencyLimit: 1,
      enabled: true,
      createdAt: '2026-06-13T00:00:00.000Z',
      updatedAt: '2026-06-13T00:00:00.000Z'
    }));
    window.yqLocal = {
      listAccounts: vi.fn(async () => []),
      addAccount,
      deleteAccount: vi.fn(async () => undefined)
    };

    render(<App storage={storage} />);

    fireEvent.change(screen.getByLabelText('账号名'), {
      target: { value: '本机账号' }
    });
    fireEvent.change(screen.getByLabelText('Access Key'), {
      target: { value: 'ak-native' }
    });
    fireEvent.change(screen.getByLabelText('Secret Key'), {
      target: { value: 'sk-native' }
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    await waitFor(() => {
      expect(screen.getByLabelText('当前账号')).toHaveValue('native-account-1');
    });
    expect(addAccount).toHaveBeenCalledWith({
      name: '本机账号',
      accessKeyId: 'ak-native',
      secretAccessKey: 'sk-native'
    });
    expect(storage.getItem('yq-workspace:v1')).not.toContain('sk-native');
  });
});
