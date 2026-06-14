import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  Film,
  FolderOpen,
  ImagePlus,
  KeyRound,
  Moon,
  Plus,
  Sun,
  Trash2,
  Wand2,
  X
} from 'lucide-react';
import {
  ChangeEvent,
  ClipboardEvent,
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
  createInitialDraft,
  isXiaoyunqueApiKey,
  selectAccount,
  updateDraft
} from './domain/state';
import {
  clearWorkspaceState,
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

type ThemeMode = 'light' | 'dark';

const DEFAULT_ACCOUNT_FORM: AccountFormState = {
  name: '',
  apiKey: ''
};
const THEME_STORAGE_KEY = 'yqhub-theme:v1';
const MAX_ASSETS = 8;

function getBrowserStorage(): StorageLike {
  return window.localStorage;
}

export default function App({ storage = getBrowserStorage() }: AppProps) {
  const [state, setState] = useState<WorkspaceState>(() => loadWorkspaceState(storage));
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme(storage));
  const [accountForm, setAccountForm] = useState<AccountFormState>(DEFAULT_ACCOUNT_FORM);
  const [notice, setNotice] = useState('就绪');
  const nativeApi = getNativeLocalApi();

  const currentAccount = useMemo(
    () => state.accounts.find((account) => account.id === state.currentAccountId) ?? null,
    [state.accounts, state.currentAccountId]
  );
  const completedTasks = useMemo(
    () => state.tasks.filter((task) => task.status === 'done'),
    [state.tasks]
  );
  const activeTasks = useMemo(
    () => state.tasks.filter((task) => task.status !== 'done'),
    [state.tasks]
  );

  useEffect(() => {
    saveWorkspaceState(storage, state);
    setNotice((current) => (current === '就绪' || current === '已保存' ? '已保存' : current));
  }, [state, storage]);

  useEffect(() => {
    storage.setItem(THEME_STORAGE_KEY, theme);
  }, [storage, theme]);

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
        currentAccountId:
          current.currentAccountId && accounts.some((account) => account.id === current.currentAccountId)
            ? current.currentAccountId
            : accounts[0]?.id ?? null
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [nativeApi]);

  useEffect(() => {
    if (!nativeApi || state.tasks.length === 0) {
      return;
    }

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
            const message = error instanceof Error ? error.message : '查询失败';
            setNotice(message);
            setState((current) => markTaskFailed(current, task.id, message));
          });
      }
    }, 3500);

    return () => window.clearInterval(timer);
  }, [nativeApi, state.tasks]);

  const handleThemeToggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

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

      if (!accountForm.name.trim() || !accountForm.apiKey.trim()) {
        setNotice('请补全账号');
        return;
      }

      if (!isXiaoyunqueApiKey(accountForm.apiKey)) {
        setNotice('只支持小云雀官网发放的 ak- API Key');
        return;
      }

      if (nativeApi) {
        try {
          const account = await nativeApi.addAccount(accountForm);
          setState((current) => ({
            ...current,
            accounts: [...current.accounts, account],
            currentAccountId: account.id
          }));
        } catch (error) {
          setNotice(error instanceof Error ? error.message : '账号添加失败');
          return;
        }
      } else {
        setState((current) => addApiAccount(current, accountForm));
      }

      setAccountForm(DEFAULT_ACCOUNT_FORM);
      setNotice('账号已保存');
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
    if (!nativeApi) {
      setNotice('请打开桌面端生成');
      return;
    }

    if (!state.currentAccountId) {
      setNotice('先添加账号');
      return;
    }

    if (!state.draft.prompt.trim() && state.draft.assets.every((asset) => !asset.label.trim())) {
      setNotice('先写提示词');
      return;
    }

    const nextState = createGenerationTask(state);
    const task = nextState.tasks.at(-1);

    if (!task) {
      return;
    }

    setState(nextState);
    setNotice('已提交');
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
        const message = error instanceof Error ? error.message : '生成失败';
        setNotice(message);
        setState((current) => markTaskFailed(current, task.id, message));
      });
  }, [nativeApi, state]);

  const handleClearDraft = useCallback(() => {
    setState((current) => clearDraft(current));
    setNotice('草稿已清空');
  }, []);

  const handleClearWorkspace = useCallback(() => {
    clearWorkspaceState(storage);
    setState((current) => ({
      ...current,
      draft: createInitialDraft(),
      tasks: []
    }));
    setNotice('缓存已清空');
  }, [storage]);

  const handleRemoveAsset = useCallback((assetId: string) => {
    setState((current) =>
      updateDraft(current, {
        assets: current.draft.assets.filter((asset) => asset.id !== assetId)
      })
    );
  }, []);

  const handleRemoveTask = useCallback((taskId: string) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId)
    }));
  }, []);

  const handleOpenVideo = useCallback(
    (task: WorkspaceState['tasks'][number]) => {
      const target = task.localVideoPath ?? task.videoUrl;

      if (!target) {
        setNotice('成片还没生成');
        return;
      }

      if (nativeApi) {
        void nativeApi
          .openVideo(target)
          .then(() => {
            setNotice('已打开');
          })
          .catch((error: unknown) => {
            setNotice(error instanceof Error ? error.message : '打开失败');
          });
        return;
      }

      window.open(target, '_blank', 'noopener,noreferrer');
    },
    [nativeApi]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const remainingSlots = Math.max(0, MAX_ASSETS - state.draft.assets.length);

      if (remainingSlots === 0) {
        setNotice('素材已满');
        return;
      }

      const supportedFiles = Array.from(files)
        .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/'))
        .slice(0, remainingSlots);

      if (supportedFiles.length === 0) {
        setNotice('素材格式不支持');
        return;
      }

      void Promise.all(supportedFiles.map((file, index) => createAssetReference(file, index)))
        .then((nextAssets) => {
          setState((current) =>
            updateDraft(current, {
              assets: [...current.draft.assets, ...nextAssets].slice(0, MAX_ASSETS)
            })
          );
          setNotice('素材已添加');
        })
        .catch(() => setNotice('素材读取失败'));
    },
    [state.draft.assets.length]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      if (event.clipboardData.files.length > 0) {
        handleFiles(event.clipboardData.files);
      }
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        handleFiles(event.target.files);
        event.target.value = '';
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

  return (
    <main
      aria-label="应用外壳"
      className="app-shell"
      data-theme={theme}
      onPaste={handlePaste}
    >
      <TopBar
        accountName={currentAccount?.name ?? '未选择'}
        activeCount={activeTasks.length}
        completedCount={completedTasks.length}
        notice={notice}
        onThemeToggle={handleThemeToggle}
        theme={theme}
      />
      <section className="workbench" aria-label="视频生成工作台">
        <AssetPanel
          accountForm={accountForm}
          accounts={state.accounts}
          assets={state.draft.assets}
          currentAccountId={state.currentAccountId}
          maxAssets={MAX_ASSETS}
          onAccountField={handleAccountField}
          onAddAccount={handleAddAccount}
          onAssetLabel={handleAssetLabel}
          onDrop={handleDrop}
          onFileInput={handleFileInput}
          onRemoveAsset={handleRemoveAsset}
          onSelectAccount={handleSelectAccount}
        />
        <ComposerPanel
          assets={state.draft.assets}
          draft={state.draft}
          nativeReady={Boolean(nativeApi)}
          onClearDraft={handleClearDraft}
          onDraftField={handleDraftField}
          onGenerate={handleGenerate}
        />
        <QueuePanel
          accounts={state.accounts}
          onClearWorkspace={handleClearWorkspace}
          onOpenVideo={handleOpenVideo}
          onRemoveTask={handleRemoveTask}
          tasks={state.tasks}
        />
      </section>
    </main>
  );
}

interface TopBarProps {
  accountName: string;
  activeCount: number;
  completedCount: number;
  notice: string;
  onThemeToggle: () => void;
  theme: ThemeMode;
}

function TopBar({
  accountName,
  activeCount,
  completedCount,
  notice,
  onThemeToggle,
  theme
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-word">
        <h1>YQhub</h1>
        <span>小云雀工作台</span>
      </div>
      <div className="topbar-status" aria-label="状态">
        <StatusPill icon={<KeyRound size={15} />} label={accountName} />
        <StatusPill icon={<Clock3 size={15} />} label={`队列 ${activeCount}`} />
        <StatusPill icon={<Database size={15} />} label={`历史 ${completedCount}`} />
        <StatusPill icon={<Activity size={15} />} label={notice} tone="quiet" live />
      </div>
      <button className="theme-button" type="button" onClick={onThemeToggle}>
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        {theme === 'dark' ? '浅色' : '深色'}
      </button>
    </header>
  );
}

interface StatusPillProps {
  icon: ReactNode;
  label: string;
  live?: boolean;
  tone?: 'quiet';
}

function StatusPill({ icon, label, live, tone }: StatusPillProps) {
  return (
    <span className="status-pill" data-tone={tone} role={live ? 'status' : undefined}>
      {icon}
      {label}
    </span>
  );
}

interface AssetPanelProps {
  accountForm: AccountFormState;
  accounts: WorkspaceState['accounts'];
  assets: AssetReference[];
  currentAccountId: string | null;
  maxAssets: number;
  onAccountField: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddAccount: (event: FormEvent<HTMLFormElement>) => void;
  onAssetLabel: (assetId: string, label: string) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAsset: (assetId: string) => void;
  onSelectAccount: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function AssetPanel({
  accountForm,
  accounts,
  assets,
  currentAccountId,
  maxAssets,
  onAccountField,
  onAddAccount,
  onAssetLabel,
  onDrop,
  onFileInput,
  onRemoveAsset,
  onSelectAccount
}: AssetPanelProps) {
  return (
    <aside className="workspace-panel asset-panel" aria-label="素材与账号">
      <PanelHeading title="素材" meta={`${assets.length}/${maxAssets}`} icon={<ImagePlus size={18} />} />
      <AccountBlock
        accountForm={accountForm}
        accounts={accounts}
        currentAccountId={currentAccountId}
        onAccountField={onAccountField}
        onAddAccount={onAddAccount}
        onSelectAccount={onSelectAccount}
      />
      <AssetDropzone onDrop={onDrop} onFileInput={onFileInput} />
      <div className="asset-list" aria-label="参考素材列表">
        {assets.length === 0 ? (
          <div className="empty-state">添加参考素材</div>
        ) : (
          assets.map((asset, index) => (
            <AssetCard
              asset={asset}
              index={index}
              key={asset.id}
              onAssetLabel={onAssetLabel}
              onRemoveAsset={onRemoveAsset}
            />
          ))
        )}
      </div>
    </aside>
  );
}

interface AccountBlockProps {
  accountForm: AccountFormState;
  accounts: WorkspaceState['accounts'];
  currentAccountId: string | null;
  onAccountField: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddAccount: (event: FormEvent<HTMLFormElement>) => void;
  onSelectAccount: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function AccountBlock({
  accountForm,
  accounts,
  currentAccountId,
  onAccountField,
  onAddAccount,
  onSelectAccount
}: AccountBlockProps) {
  return (
    <section className="account-block" aria-label="账号">
      <label>
        <span>当前账号</span>
        <select value={currentAccountId ?? ''} onChange={onSelectAccount} disabled={accounts.length === 0}>
          {accounts.length === 0 ? <option value="">未添加</option> : null}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <form className="account-form" onSubmit={onAddAccount}>
        <label>
          <span>账号名</span>
          <input name="name" value={accountForm.name} onChange={onAccountField} placeholder="我的账号" />
        </label>
        <label>
          <span>API Key</span>
          <input
            autoComplete="off"
            name="apiKey"
            spellCheck={false}
            type="password"
            value={accountForm.apiKey}
            onChange={onAccountField}
            placeholder="ak-..."
          />
        </label>
        <button className="small-button" type="submit">
          <Plus size={15} />
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
      <strong>拖入或选择</strong>
    </label>
  );
}

interface AssetCardProps {
  asset: AssetReference;
  index: number;
  onAssetLabel: (assetId: string, label: string) => void;
  onRemoveAsset: (assetId: string) => void;
}

function AssetCard({ asset, index, onAssetLabel, onRemoveAsset }: AssetCardProps) {
  const labelPrefix = getAssetLabelPrefix(asset.type, index);

  return (
    <article className="asset-card">
      <div className="asset-preview">
        <AssetPreview asset={asset} label={labelPrefix} />
      </div>
      <div className="asset-meta">
        <label>
          <span>{labelPrefix}</span>
          <input
            value={asset.label}
            onChange={(event) => onAssetLabel(asset.id, event.target.value)}
            placeholder={`${labelPrefix}是...`}
          />
        </label>
        <button aria-label={`移除${labelPrefix}`} className="icon-button" type="button" onClick={() => onRemoveAsset(asset.id)}>
          <X size={15} />
        </button>
      </div>
    </article>
  );
}

interface AssetPreviewProps {
  asset: AssetReference;
  label: string;
}

function AssetPreview({ asset, label }: AssetPreviewProps) {
  if (asset.type === 'image') {
    return <img alt={asset.localName} src={asset.previewUrl} />;
  }

  if (asset.type === 'video') {
    return <video aria-label={asset.localName} muted preload="metadata" src={asset.previewUrl} />;
  }

  return (
    <div className="audio-preview">
      <Film size={18} />
      <span>{label}</span>
    </div>
  );
}

interface ComposerPanelProps {
  assets: AssetReference[];
  draft: WorkspaceState['draft'];
  nativeReady: boolean;
  onClearDraft: () => void;
  onDraftField: (event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => void;
  onGenerate: () => void;
}

function ComposerPanel({
  assets,
  draft,
  nativeReady,
  onClearDraft,
  onDraftField,
  onGenerate
}: ComposerPanelProps) {
  const defaultModel = getDefaultModelCapabilities();
  const selectableModels = Object.values(MODEL_CAPABILITIES).filter(
    (model) => model.submitMappingStatus === 'known'
  );

  return (
    <section className="workspace-panel composer-panel" aria-label="创作台">
      <div className="composer-head">
        <PanelHeading title="视频生成" meta="Seedance 2.0 Fast" icon={<Wand2 size={18} />} />
        <span className="desktop-state" data-ready={nativeReady}>
          {nativeReady ? '桌面端' : '预览'}
        </span>
      </div>

      <PreviewStage assets={assets} />

      <label className="prompt-box">
        <span>提示词</span>
        <textarea
          aria-label="提示词"
          name="prompt"
          value={draft.prompt}
          onChange={onDraftField}
          placeholder="写下画面、人物、动作、镜头和风格"
        />
      </label>

      <div className="control-grid">
        <label>
          <span>模型</span>
          <select aria-label="模型" name="model" value={draft.model} onChange={onDraftField}>
            {selectableModels.map((model) => (
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
              <option key={duration} value={duration}>
                {formatDurationLabel(duration)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>清晰度</span>
          <select aria-label="清晰度" name="resolution" value={draft.resolution} onChange={onDraftField}>
            {defaultModel.supportedResolutions.map((resolution) => (
              <option key={resolution} value={resolution}>
                {resolution}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>画幅</span>
          <select aria-label="画幅" name="ratio" value={draft.ratio} onChange={onDraftField}>
            {defaultModel.supportedRatios.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio === 'adaptive' ? '自适应' : ratio}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="generate-bar">
        <button className="ghost-button" type="button" onClick={onClearDraft}>
          <Trash2 size={16} />
          清空
        </button>
        <button className="primary-button" type="button" onClick={onGenerate}>
          <Film size={18} />
          生成
        </button>
      </div>
    </section>
  );
}

interface PreviewStageProps {
  assets: AssetReference[];
}

function PreviewStage({ assets }: PreviewStageProps) {
  const leadAsset = assets.find((asset) => asset.type === 'image' || asset.type === 'video') ?? null;

  return (
    <section className="preview-stage" aria-label="预览">
      {leadAsset ? <AssetPreview asset={leadAsset} label="预览" /> : <div className="preview-empty">等待素材</div>}
      {assets.length > 1 ? <span className="preview-count">+{assets.length - 1}</span> : null}
    </section>
  );
}

interface QueuePanelProps {
  accounts: WorkspaceState['accounts'];
  onClearWorkspace: () => void;
  onOpenVideo: (task: WorkspaceState['tasks'][number]) => void;
  onRemoveTask: (taskId: string) => void;
  tasks: WorkspaceState['tasks'];
}

function QueuePanel({
  accounts,
  onClearWorkspace,
  onOpenVideo,
  onRemoveTask,
  tasks
}: QueuePanelProps) {
  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );
  const activeTasks = tasks.filter((task) => task.status !== 'done');
  const completedTasks = tasks.filter((task) => task.status === 'done');

  return (
    <aside className="workspace-panel queue-panel" aria-label="任务区">
      <section className="queue-section">
        <PanelHeading icon={<Clock3 size={18} />} title="队列" meta={String(activeTasks.length)} />
        <div className="task-list">
          {activeTasks.length === 0 ? (
            <div className="empty-state">生成后显示进度</div>
          ) : (
            activeTasks.map((task) => (
              <TaskItem
                accountName={accountNames.get(task.accountId) ?? '本地账号'}
                key={task.id}
                onOpenVideo={onOpenVideo}
                onRemoveTask={onRemoveTask}
                task={task}
              />
            ))
          )}
        </div>
      </section>

      <section className="queue-section history-section">
        <PanelHeading icon={<Database size={18} />} title="历史" meta={String(completedTasks.length)} />
        <div className="history-list">
          {completedTasks.length === 0 ? (
            <div className="empty-state">完成后自动保存</div>
          ) : (
            completedTasks.map((task) => (
              <button
                className="history-item"
                disabled={!task.localVideoPath && !task.videoUrl}
                key={task.id}
                onClick={() => onOpenVideo(task)}
                type="button"
              >
                <span>{task.prompt || task.finalPrompt}</span>
                <strong>{task.resolution}</strong>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="cache-section" aria-label="缓存">
        <div>
          <strong>本机缓存</strong>
          <span>{tasks.length} 个任务</span>
        </div>
        <button className="small-button danger" type="button" onClick={onClearWorkspace}>
          <Trash2 size={15} />
          清除
        </button>
      </section>
    </aside>
  );
}

interface TaskItemProps {
  accountName: string;
  onOpenVideo: (task: WorkspaceState['tasks'][number]) => void;
  onRemoveTask: (taskId: string) => void;
  task: WorkspaceState['tasks'][number];
}

function TaskItem({ accountName, onOpenVideo, onRemoveTask, task }: TaskItemProps) {
  const canOpen = Boolean(task.localVideoPath || task.videoUrl);

  return (
    <article className="task-item" data-status={task.status}>
      <div className="task-title">
        <strong>{task.prompt || task.finalPrompt}</strong>
        <StatusIcon status={task.status} />
      </div>
      <div className="task-meta">
        <span>{getStatusText(task.status)}</span>
        <span>{accountName}</span>
        <span>{formatDurationLabel(task.duration)}</span>
        <span>{task.resolution}</span>
      </div>
      <div
        className="progress-track"
        aria-label="生成进度"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={task.progress}
        role="progressbar"
      >
        <div className="progress-fill" style={{ width: `${task.progress}%` }} />
      </div>
      <div className="task-bottom">
        <span>{task.etaSeconds === null ? '估算中' : `约 ${task.etaSeconds} 秒`}</span>
        <div className="task-actions">
          <button disabled={!canOpen} onClick={() => onOpenVideo(task)} type="button">
            <FolderOpen size={14} />
            打开
          </button>
          <button aria-label="删除任务" className="icon-button" onClick={() => onRemoveTask(task.id)} type="button">
            <X size={14} />
          </button>
        </div>
      </div>
      {task.errorMessage ? (
        <div className="task-error">
          <AlertCircle size={15} />
          {task.errorMessage}
        </div>
      ) : null}
    </article>
  );
}

interface PanelHeadingProps {
  icon: ReactNode;
  meta?: string;
  title: string;
}

function PanelHeading({ icon, meta, title }: PanelHeadingProps) {
  return (
    <div className="panel-heading">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}

function StatusIcon({ status }: { status: WorkspaceState['tasks'][number]['status'] }) {
  if (status === 'done') {
    return <CheckCircle2 aria-label="已完成" size={17} />;
  }

  if (status === 'failed' || status === 'expired' || status === 'not_found') {
    return <AlertCircle aria-label="失败" size={17} />;
  }

  return <Activity aria-label="生成中" size={17} />;
}

async function createAssetReference(file: File, index: number): Promise<AssetReference> {
  const type = getAssetType(file);
  const dataUrl = await readFileAsDataUrl(file);

  return {
    id: `asset-${Date.now()}-${index}`,
    type,
    label: '',
    localName: file.name,
    previewUrl: dataUrl,
    dataUrl,
    mimeType: file.type,
    uploadStatus: 'local'
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('素材读取失败')));
    reader.readAsDataURL(file);
  });
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
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八'];
  return numerals[order - 1] ?? String(order);
}

function formatDurationLabel(duration: string): string {
  return `${duration.replace(/s$/u, '')} 秒`;
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

function loadTheme(storage: StorageLike): ThemeMode {
  return storage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function markTaskFailed(state: WorkspaceState, taskId: string, message: string): WorkspaceState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: 'failed',
            progress: 0,
            etaSeconds: 0,
            errorMessage: message,
            updatedAt: new Date(0).toISOString()
          }
        : task
    )
  };
}
