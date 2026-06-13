import {
  Clock3,
  Database,
  ImagePlus,
  KeyRound,
  Plus,
  Trash2,
  Wand2
} from 'lucide-react';
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  addApiAccount,
  clearDraft,
  createGenerationTask,
  createInitialState,
  selectAccount,
  updateDraft
} from './domain/state';
import {
  loadWorkspaceState,
  saveWorkspaceState,
  type StorageLike
} from './domain/persistence';
import type { ApiAccountInput, AssetReference, WorkspaceState } from './domain/types';
import { getNativeLocalApi } from './electronBridge';
import { getDefaultModelCapabilities, MODEL_CAPABILITIES } from './shared/modelCapabilities';
import './styles.css';

interface AppProps {
  storage?: StorageLike;
}

interface AccountFormState extends ApiAccountInput {}

const DEFAULT_ACCOUNT_FORM: AccountFormState = {
  name: '',
  accessKeyId: '',
  secretAccessKey: ''
};

function getBrowserStorage(): StorageLike {
  return window.localStorage;
}

export default function App({ storage = getBrowserStorage() }: AppProps) {
  const [state, setState] = useState<WorkspaceState>(() => loadWorkspaceState(storage));
  const [accountForm, setAccountForm] = useState<AccountFormState>(DEFAULT_ACCOUNT_FORM);
  const [notice, setNotice] = useState('已保存');
  const nativeApi = getNativeLocalApi();

  const currentAccount = useMemo(
    () => state.accounts.find((account) => account.id === state.currentAccountId) ?? null,
    [state.accounts, state.currentAccountId]
  );

  useEffect(() => {
    saveWorkspaceState(storage, state);
    setNotice('已保存');
  }, [state, storage]);

  useEffect(() => {
    if (!nativeApi) {
      return;
    }

    let cancelled = false;

    void nativeApi.listAccounts().then((accounts) => {
      if (cancelled) {
        return;
      }

      setState((current) => ({
        ...current,
        accounts,
        currentAccountId: current.currentAccountId ?? accounts[0]?.id ?? null
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [nativeApi]);

  useEffect(() => {
    if (state.tasks.length === 0) {
      return;
    }

    if (nativeApi) {
      const timer = window.setInterval(() => {
        const refreshableTasks = state.tasks.filter(
          (task) =>
            task.apiTaskId &&
            !['done', 'failed', 'expired', 'not_found'].includes(task.status)
        );

        for (const task of refreshableTasks) {
          void nativeApi
            .refreshTask(task)
            .then((updatedTask) => {
              setState((current) => ({
                ...current,
                tasks: current.tasks.map((candidate) =>
                  candidate.id === updatedTask.id ? updatedTask : candidate
                )
              }));
            })
            .catch((error: unknown) => {
              setNotice(error instanceof Error ? error.message : '查询失败');
            });
        }
      }, 3500);

      return () => window.clearInterval(timer);
    }

    const timer = window.setInterval(() => {
      setState((current) => advanceTasks(current));
    }, 1400);

    return () => window.clearInterval(timer);
  }, [nativeApi, state.tasks]);

  const handleAccountField = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setAccountForm((current) => ({
      ...current,
      [name]: value
    }));
  }, []);

  const handleAddAccount = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!accountForm.name.trim() || !accountForm.accessKeyId.trim() || !accountForm.secretAccessKey) {
        setNotice('请补全账号');
        return;
      }

      if (nativeApi) {
        const account = await nativeApi.addAccount(accountForm);
        setState((current) => ({
          ...current,
          accounts: [...current.accounts, account],
          currentAccountId: current.currentAccountId ?? account.id
        }));
      } else {
        setState((current) => addApiAccount(current, accountForm));
      }

      setAccountForm(DEFAULT_ACCOUNT_FORM);
    },
    [accountForm, nativeApi]
  );

  const handleSelectAccount = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setState((current) => selectAccount(current, event.target.value));
  }, []);

  const handleDraftField = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = event.target;
      setState((current) => updateDraft(current, { [name]: value }));
    },
    []
  );

  const handleGenerate = useCallback(() => {
    if (!state.currentAccountId) {
      setNotice('先添加账号');
      return;
    }

    if (!state.draft.prompt.trim()) {
      setNotice('先写提示词');
      return;
    }

    if (nativeApi && state.draft.assets.some((asset) => !asset.publicUrl?.trim())) {
      setNotice('请先配置素材上传方式');
      return;
    }

    if (nativeApi) {
      const nextState = createGenerationTask(state);
      const task = nextState.tasks.at(-1);

      if (!task) {
        return;
      }

      setState(nextState);
      void nativeApi
        .submitTask(task)
        .then((submittedTask) => {
          setState((current) => ({
            ...current,
            tasks: current.tasks.map((candidate) =>
              candidate.id === submittedTask.id ? submittedTask : candidate
            )
          }));
        })
        .catch((error: unknown) => {
          setNotice(error instanceof Error ? error.message : '生成失败');
        });
      return;
    }

    setState((current) => createGenerationTask(current));
  }, [nativeApi, state]);

  const handleClearDraft = useCallback(() => {
    setState((current) => clearDraft(current));
  }, []);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const nextAssets = Array.from(files)
      .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/'))
      .map((file, index) => createAssetReference(file, index));

    if (nextAssets.length === 0) {
      setNotice('素材格式不支持');
      return;
    }

    setState((current) =>
      updateDraft(current, {
        assets: [...current.draft.assets, ...nextAssets]
      })
    );
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        handleFiles(event.target.files);
      }
    },
    [handleFiles]
  );

  const handleAssetLabel = useCallback((assetId: string, label: string) => {
    setState((current) =>
      updateDraft(current, {
        assets: current.draft.assets.map((asset) =>
          asset.id === assetId
            ? {
                ...asset,
                label
              }
            : asset
        )
      })
    );
  }, []);

  const handleAssetPublicUrl = useCallback((assetId: string, publicUrl: string) => {
    setState((current) =>
      updateDraft(current, {
        assets: current.draft.assets.map((asset) =>
          asset.id === assetId
            ? {
                ...asset,
                publicUrl,
                uploadStatus: publicUrl.trim() ? 'uploaded' : 'local'
              }
            : asset
        )
      })
    );
  }, []);

  return (
    <main className="app-shell">
      <TopBar
        accountCount={state.accounts.length}
        currentAccountName={currentAccount?.name ?? '未选择'}
        notice={notice}
      />
      <section className="workspace" aria-label="视频生成工作台">
        <ComposePanel
          accountForm={accountForm}
          accounts={state.accounts}
          currentAccountId={state.currentAccountId}
          draft={state.draft}
          onAccountField={handleAccountField}
          onAddAccount={handleAddAccount}
          onAssetLabel={handleAssetLabel}
          onAssetPublicUrl={handleAssetPublicUrl}
          onClearDraft={handleClearDraft}
          onDraftField={handleDraftField}
          onDrop={handleDrop}
          onFileInput={handleFileInput}
          onGenerate={handleGenerate}
          onSelectAccount={handleSelectAccount}
        />
        <TaskPanel state={state} />
      </section>
    </main>
  );
}

interface TopBarProps {
  accountCount: number;
  currentAccountName: string;
  notice: string;
}

function TopBar({ accountCount, currentAccountName, notice }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">本地视频生成</p>
        <h1>小云雀本地生成端</h1>
      </div>
      <div className="topbar-status">
        <StatusPill icon={<KeyRound size={16} />} label={currentAccountName} />
        <StatusPill icon={<Database size={16} />} label={`${accountCount} 个账号`} />
        <StatusPill icon={<Clock3 size={16} />} label={notice} />
      </div>
    </header>
  );
}

interface StatusPillProps {
  icon: ReactNode;
  label: string;
}

function StatusPill({ icon, label }: StatusPillProps) {
  return (
    <span className="status-pill">
      {icon}
      {label}
    </span>
  );
}

interface ComposePanelProps {
  accountForm: AccountFormState;
  accounts: WorkspaceState['accounts'];
  currentAccountId: string | null;
  draft: WorkspaceState['draft'];
  onAccountField: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddAccount: (event: FormEvent<HTMLFormElement>) => void;
  onAssetLabel: (assetId: string, label: string) => void;
  onAssetPublicUrl: (assetId: string, publicUrl: string) => void;
  onClearDraft: () => void;
  onDraftField: (event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
  onSelectAccount: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function ComposePanel({
  accountForm,
  accounts,
  currentAccountId,
  draft,
  onAccountField,
  onAddAccount,
  onAssetLabel,
  onAssetPublicUrl,
  onClearDraft,
  onDraftField,
  onDrop,
  onFileInput,
  onGenerate,
  onSelectAccount
}: ComposePanelProps) {
  return (
    <section className="compose-panel" aria-label="创作区">
      <AccountBox
        accountForm={accountForm}
        accounts={accounts}
        currentAccountId={currentAccountId}
        onAccountField={onAccountField}
        onAddAccount={onAddAccount}
        onSelectAccount={onSelectAccount}
      />
      <AssetDropzone onDrop={onDrop} onFileInput={onFileInput} />
      <AssetGrid assets={draft.assets} onAssetLabel={onAssetLabel} onAssetPublicUrl={onAssetPublicUrl} />
      <PromptEditor draft={draft} onDraftField={onDraftField} />
      <GenerateBar onClearDraft={onClearDraft} onGenerate={onGenerate} />
    </section>
  );
}

interface AccountBoxProps {
  accountForm: AccountFormState;
  accounts: WorkspaceState['accounts'];
  currentAccountId: string | null;
  onAccountField: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddAccount: (event: FormEvent<HTMLFormElement>) => void;
  onSelectAccount: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function AccountBox({
  accountForm,
  accounts,
  currentAccountId,
  onAccountField,
  onAddAccount,
  onSelectAccount
}: AccountBoxProps) {
  return (
    <section className="panel-block account-box">
      <div className="block-title">
        <KeyRound size={18} />
        <h2>API 账号</h2>
      </div>
      <div className="field-grid">
        <label>
          <span>当前账号</span>
          <select value={currentAccountId ?? ''} onChange={onSelectAccount} disabled={accounts.length === 0}>
            {accounts.length === 0 ? <option value="">先添加账号</option> : null}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form className="account-form" onSubmit={onAddAccount}>
        <label>
          <span>账号名</span>
          <input name="name" value={accountForm.name} onChange={onAccountField} placeholder="剪辑账号" />
        </label>
        <label>
          <span>Access Key</span>
          <input
            name="accessKeyId"
            value={accountForm.accessKeyId}
            onChange={onAccountField}
            placeholder="AK..."
          />
        </label>
        <label>
          <span>Secret Key</span>
          <input
            name="secretAccessKey"
            value={accountForm.secretAccessKey}
            onChange={onAccountField}
            placeholder="SK..."
            type="password"
          />
        </label>
        <button className="secondary-button" type="submit">
          <Plus size={16} />
          添加
        </button>
      </form>
    </section>
  );
}

interface AssetDropzoneProps {
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
}

function AssetDropzone({ onDrop, onFileInput }: AssetDropzoneProps) {
  return (
    <label
      className="asset-dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        onChange={onFileInput}
      />
      <ImagePlus size={26} />
      <span>拖入素材，或粘贴图片</span>
    </label>
  );
}

interface AssetGridProps {
  assets: AssetReference[];
  onAssetLabel: (assetId: string, label: string) => void;
  onAssetPublicUrl: (assetId: string, publicUrl: string) => void;
}

function AssetGrid({ assets, onAssetLabel, onAssetPublicUrl }: AssetGridProps) {
  if (assets.length === 0) {
    return <div className="empty-line">添加素材后可写标注</div>;
  }

  return (
    <div className="asset-grid">
      {assets.map((asset, index) => (
        <AssetCard
          asset={asset}
          index={index}
          key={asset.id}
          onAssetLabel={onAssetLabel}
          onAssetPublicUrl={onAssetPublicUrl}
        />
      ))}
    </div>
  );
}

interface AssetCardProps {
  asset: AssetReference;
  index: number;
  onAssetLabel: (assetId: string, label: string) => void;
  onAssetPublicUrl: (assetId: string, publicUrl: string) => void;
}

function AssetCard({ asset, index, onAssetLabel, onAssetPublicUrl }: AssetCardProps) {
  const labelPrefix = getAssetLabelPrefix(asset.type, index);

  return (
    <article className="asset-card">
      <div className="asset-preview">
        {asset.type === 'image' ? <img alt={asset.localName} src={asset.previewUrl} /> : <span>{labelPrefix}</span>}
      </div>
      <label>
        <span>{labelPrefix}</span>
        <input
          value={asset.label}
          onChange={(event) => onAssetLabel(asset.id, event.target.value)}
          placeholder={`${labelPrefix}是...`}
        />
      </label>
      <label>
        <span>公网 URL</span>
        <input
          aria-label={`${labelPrefix}公网 URL`}
          value={asset.publicUrl ?? ''}
          onChange={(event) => onAssetPublicUrl(asset.id, event.target.value)}
          placeholder="https://..."
        />
      </label>
    </article>
  );
}

interface PromptEditorProps {
  draft: WorkspaceState['draft'];
  onDraftField: (event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => void;
}

function PromptEditor({ draft, onDraftField }: PromptEditorProps) {
  const defaultModel = getDefaultModelCapabilities();

  return (
    <section className="panel-block prompt-block">
      <label>
        <span>提示词</span>
        <textarea
          aria-label="提示词"
          name="prompt"
          value={draft.prompt}
          onChange={onDraftField}
          placeholder="写下你想生成的视频内容"
        />
      </label>
      <div className="field-grid two">
        <label>
          <span>模型</span>
          <select aria-label="模型" name="model" value={draft.model} onChange={onDraftField}>
            {Object.values(MODEL_CAPABILITIES).map((model) => (
              <option key={model.model} value={model.model}>
                {model.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>时长</span>
          <select aria-label="时长" name="duration" value={draft.duration} onChange={onDraftField}>
            {defaultModel.supportedDurations.map((duration) => (
              <option key={duration} value={`${duration}s`}>
                {duration} 秒
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>分辨率</span>
          <select aria-label="分辨率" name="resolution" value={draft.resolution} onChange={onDraftField}>
            {defaultModel.supportedResolutions.map((resolution) => (
              <option key={resolution} value={resolution}>
                {resolution}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

interface GenerateBarProps {
  onClearDraft: () => void;
  onGenerate: () => void;
}

function GenerateBar({ onClearDraft, onGenerate }: GenerateBarProps) {
  return (
    <div className="generate-bar">
      <button className="ghost-button" type="button" onClick={onClearDraft}>
        <Trash2 size={16} />
        清空
      </button>
      <button className="primary-button" type="button" onClick={onGenerate}>
        <Wand2 size={18} />
        生成
      </button>
    </div>
  );
}

interface TaskPanelProps {
  state: WorkspaceState;
}

function TaskPanel({ state }: TaskPanelProps) {
  const accountNames = useMemo(
    () => new Map(state.accounts.map((account) => [account.id, account.name])),
    [state.accounts]
  );
  const completedTasks = state.tasks.filter((task) => task.status === 'done');

  return (
    <aside className="task-panel" aria-label="任务区">
      <section className="panel-block queue-block">
        <div className="block-title">
          <Clock3 size={18} />
          <h2>生成队列</h2>
        </div>
        {state.tasks.length === 0 ? (
          <div className="empty-state">生成后会显示进度</div>
        ) : (
          <div className="task-list">
            {state.tasks.map((task) => (
              <TaskItem
                accountName={accountNames.get(task.accountId) ?? '本地账号'}
                key={task.id}
                task={task}
              />
            ))}
          </div>
        )}
      </section>
      <section className="panel-block history-block">
        <div className="block-title">
          <Database size={18} />
          <h2>生成历史</h2>
        </div>
        {completedTasks.length === 0 ? (
          <div className="empty-state">生成完成后会保存在这里</div>
        ) : (
          <div className="history-list">
            {completedTasks.map((task) => (
              <a className="history-item" href={task.videoUrl ?? '#'} key={task.id}>
                <span>{task.prompt}</span>
                <strong>{task.resolution}</strong>
              </a>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

interface TaskItemProps {
  accountName: string;
  task: WorkspaceState['tasks'][number];
}

function TaskItem({ accountName, task }: TaskItemProps) {
  return (
    <article className="task-item">
      <div className="task-header">
        <strong>{task.prompt}</strong>
        <span>{accountName}</span>
      </div>
      <div className="task-meta">
        <span>{getStatusText(task.status)}</span>
        <span>{task.duration}</span>
        <span>{task.resolution}</span>
      </div>
      <div className="progress-track" aria-label="生成进度">
        <div className="progress-fill" style={{ width: `${task.progress}%` }} />
      </div>
      <div className="eta-line">{task.etaSeconds === null ? '估算中' : `约 ${task.etaSeconds} 秒`}</div>
      <div className="task-actions">
        <button type="button">打开</button>
        <button type="button">重试</button>
        <button type="button">删除</button>
      </div>
    </article>
  );
}

function createAssetReference(file: File, index: number): AssetReference {
  const type = getAssetType(file);

  return {
    id: `asset-${Date.now()}-${index}`,
    type,
    label: '',
    localName: file.name,
    previewUrl: URL.createObjectURL(file),
    uploadStatus: 'local'
  };
}

function getAssetType(file: File): AssetReference['type'] {
  if (file.type.startsWith('video/')) {
    return 'video';
  }

  if (file.type.startsWith('audio/')) {
    return 'audio';
  }

  return 'image';
}

function getAssetLabelPrefix(type: AssetReference['type'], index: number): string {
  const order = formatOrder(index + 1);

  if (type === 'video') {
    return `视频${order}`;
  }

  if (type === 'audio') {
    return `音频${order}`;
  }

  return `图${order}`;
}

function formatOrder(order: number): string {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return numerals[order - 1] ?? String(order);
}

function getStatusText(status: WorkspaceState['tasks'][number]['status']): string {
  const statusMap: Record<WorkspaceState['tasks'][number]['status'], string> = {
    draft: '草稿',
    in_queue: '排队中',
    processing: '处理中',
    generating: '生成中',
    done: '已完成',
    failed: '失败',
    expired: '已过期',
    not_found: '未找到'
  };

  return statusMap[status];
}

function advanceTasks(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.status === 'done' || task.status === 'failed') {
        return task;
      }

      const nextProgress = Math.min(task.progress + 18, 100);
      const nextStatus = nextProgress >= 100 ? 'done' : nextProgress >= 64 ? 'generating' : 'processing';

      return {
        ...task,
        progress: nextProgress,
        status: nextStatus,
        etaSeconds: nextStatus === 'done' ? 0 : Math.max(8, 120 - nextProgress),
        videoUrl:
          nextStatus === 'done'
            ? `https://example.com/local-history/${encodeURIComponent(task.id)}.mp4`
            : task.videoUrl,
        localVideoPath:
          nextStatus === 'done'
            ? `~/Movies/YQ/exports/${task.id}.mp4`
            : task.localVideoPath,
        updatedAt: new Date(0).toISOString()
      };
    })
  };
}
