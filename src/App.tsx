import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Film,
  FolderOpen,
  ImagePlus,
  KeyRound,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  Wand2,
  X
} from 'lucide-react';
import {
  ChangeEvent,
  ClipboardEvent,
  CSSProperties,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
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
import type { ApiAccountInput, AssetReference, GenerationTask, WorkspaceState } from './domain/types';
import { getNativeLocalApi } from './electronBridge';
import { getDefaultModelCapabilities, MODEL_CAPABILITIES } from './shared/modelCapabilities';
import appPackage from '../package.json';
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
const DEFAULT_EXPORT_DIRECTORY = '~/Downloads';
const THEME_STORAGE_KEY = 'yqhub-theme:v1';
const MAX_ASSETS = 8;
const APP_VERSION = appPackage.version;
const CURRENT_TASK_TITLE_LIMIT = 30;

function getBrowserStorage(): StorageLike {
  return window.localStorage;
}

export default function App({ storage = getBrowserStorage() }: AppProps) {
  const [state, setState] = useState<WorkspaceState>(() => loadWorkspaceState(storage));
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme(storage));
  const [accountForm, setAccountForm] = useState<AccountFormState>(DEFAULT_ACCOUNT_FORM);
  const [exportDirectory, setExportDirectory] = useState(DEFAULT_EXPORT_DIRECTORY);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AssetReference | null>(null);
  const [notice, setNotice] = useState('就绪');
  const nativeApi = getNativeLocalApi();

  const currentAccount = useMemo(
    () => state.accounts.find((account) => account.id === state.currentAccountId) ?? null,
    [state.accounts, state.currentAccountId]
  );
  const completedTasks = useMemo(
    () => state.tasks.filter((task) => task.status === 'done').slice().reverse(),
    [state.tasks]
  );
  const activeTasks = useMemo(
    () => state.tasks.filter((task) => task.status !== 'done').slice().reverse(),
    [state.tasks]
  );
  const selectedPreviewTask = useMemo(
    () => state.tasks.find((task) => task.id === previewTaskId) ?? null,
    [previewTaskId, state.tasks]
  );
  const previewTask = selectedPreviewTask ?? activeTasks[0] ?? completedTasks[0] ?? null;

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

    void nativeApi
      .getExportDirectory()
      .then((directory) => {
        if (!cancelled) {
          setExportDirectory(directory);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExportDirectory(DEFAULT_EXPORT_DIRECTORY);
        }
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
            if (updatedTask.status === 'done') {
              setPreviewTaskId(updatedTask.id);
            }
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
    if (!event.target.value) {
      return;
    }

    setState((current) => selectAccount(current, event.target.value));
  }, []);

  const handleChooseExportDirectory = useCallback(() => {
    if (!nativeApi) {
      setNotice('请打开桌面端更改');
      return;
    }

    void nativeApi
      .chooseExportDirectory()
      .then((directory) => {
        setExportDirectory(directory);
        setNotice('保存位置已更新');
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : '选择失败');
      });
  }, [nativeApi]);

  const handleDraftField = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement>) => {
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
    setPreviewTaskId(task.id);
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
    setPreviewTaskId(null);
    setNotice('本地记录已清空');
  }, [storage]);

  const handleRemoveAsset = useCallback((assetId: string) => {
    setState((current) =>
      updateDraft(current, {
        assets: current.draft.assets.filter((asset) => asset.id !== assetId)
      })
    );
    setPreviewAsset((current) => (current?.id === assetId ? null : current));
  }, []);

  const handlePreviewAsset = useCallback((asset: AssetReference) => {
    setPreviewAsset(asset);
  }, []);

  const handleCloseAssetPreview = useCallback(() => {
    setPreviewAsset(null);
  }, []);

  const handleRemoveTask = useCallback((taskId: string) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId)
    }));
    setPreviewTaskId((current) => (current === taskId ? null : current));
  }, []);

  const handleOpenVideo = useCallback(
    (task: GenerationTask) => {
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

  const handlePlayTask = useCallback((task: GenerationTask) => {
    setPreviewTaskId(task.id);
    setNotice(task.localVideoPath || task.videoUrl ? '已载入预览' : '成片还没生成');
  }, []);

  const handleReuseTask = useCallback((task: GenerationTask) => {
    setState((current) =>
      updateDraft(current, {
        prompt: task.prompt,
        assets: task.assets.map((asset, index) => ({
          ...asset,
          id: `${asset.id}-reuse-${Date.now()}-${index}`
        })),
        duration: task.duration,
        resolution: task.resolution,
        ratio: task.ratio,
        model: task.model,
        outputName: ''
      })
    );
    setNotice('已复用');
  }, []);

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
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer.files.length > 0) {
        handleFiles(event.dataTransfer.files);
      }
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

  const handlePromptContextMenu = useCallback(
    (event: MouseEvent<HTMLTextAreaElement>) => {
      if (!nativeApi?.showEditContextMenu) {
        return;
      }

      event.preventDefault();
      void nativeApi.showEditContextMenu();
    },
    [nativeApi]
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
        accountForm={accountForm}
        accounts={state.accounts}
        activeCount={activeTasks.length}
        completedCount={completedTasks.length}
        currentAccountId={state.currentAccountId}
        exportDirectory={exportDirectory}
        notice={notice}
        onAccountField={handleAccountField}
        onAddAccount={handleAddAccount}
        onChooseExportDirectory={handleChooseExportDirectory}
        onSelectAccount={handleSelectAccount}
        onThemeToggle={handleThemeToggle}
        theme={theme}
      />
      <section className="workbench" aria-label="视频生成工作台">
        <section className="editor-column" aria-label="生成设置">
          <AssetPanel
            assets={state.draft.assets}
            maxAssets={MAX_ASSETS}
            onAssetLabel={handleAssetLabel}
            onDrop={handleDrop}
            onFileInput={handleFileInput}
            onPreviewAsset={handlePreviewAsset}
            onRemoveAsset={handleRemoveAsset}
          />
          <PromptPanel
            draft={state.draft}
            onDraftField={handleDraftField}
            onPromptContextMenu={handlePromptContextMenu}
          />
          <ModelControls draft={state.draft} onDraftField={handleDraftField} />
          <div className="generate-bar">
            <button className="ghost-button" type="button" onClick={handleClearDraft}>
              <Trash2 size={16} />
              清空
            </button>
            <button className="primary-button" type="button" onClick={handleGenerate}>
              <Film size={18} />
              生成
            </button>
          </div>
        </section>

        <section className="preview-column">
          <PreviewPanel task={previewTask} />
          <CurrentTaskPanel
            accounts={state.accounts}
            onOpenVideo={handleOpenVideo}
            onRemoveTask={handleRemoveTask}
            tasks={activeTasks}
          />
        </section>

        <HistoryPanel
          onClearWorkspace={handleClearWorkspace}
          onOpenVideo={handleOpenVideo}
          onPlayTask={handlePlayTask}
          onRemoveTask={handleRemoveTask}
          onReuseTask={handleReuseTask}
          tasks={completedTasks}
        />
      </section>
      {previewAsset ? (
        <AssetPreviewDialog asset={previewAsset} onClose={handleCloseAssetPreview} theme={theme} />
      ) : null}
    </main>
  );
}

interface TopBarProps {
  accountForm: AccountFormState;
  accounts: WorkspaceState['accounts'];
  activeCount: number;
  completedCount: number;
  currentAccountId: string | null;
  exportDirectory: string;
  notice: string;
  onAccountField: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddAccount: (event: FormEvent<HTMLFormElement>) => void;
  onChooseExportDirectory: () => void;
  onSelectAccount: (event: ChangeEvent<HTMLSelectElement>) => void;
  onThemeToggle: () => void;
  theme: ThemeMode;
}

function TopBar({
  accountForm,
  accounts,
  activeCount,
  completedCount,
  currentAccountId,
  exportDirectory,
  notice,
  onAccountField,
  onAddAccount,
  onChooseExportDirectory,
  onSelectAccount,
  onThemeToggle,
  theme
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-word">
        <h1>YQhub</h1>
        <span>小云雀工作台</span>
      </div>
      <section className="account-save-bar" aria-label="账号与保存">
        <label className="compact-field">
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

        <form className="account-form-inline" onSubmit={onAddAccount}>
          <label className="compact-field">
            <span>账号名</span>
            <input name="name" value={accountForm.name} onChange={onAccountField} placeholder="账号" />
          </label>
          <label className="compact-field api-key-field">
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

        <div className="save-location" title={exportDirectory}>
          <span>保存到</span>
          <strong>{exportDirectory}</strong>
        </div>
        <button className="small-button" type="button" onClick={onChooseExportDirectory}>
          <FolderOpen size={15} />
          更改
        </button>
      </section>
      <div className="topbar-side">
        <StatusPill icon={<Clock3 size={15} />} label={`任务 ${activeCount}`} />
        <StatusPill icon={<Film size={15} />} label={`本地记录 ${completedCount}`} />
        <StatusPill className="version-pill" icon={<CheckCircle2 size={15} />} label={`v${APP_VERSION}`} />
        <StatusPill className="notice-pill" icon={<Activity size={15} />} label={notice} live />
        <button className="theme-button" type="button" onClick={onThemeToggle}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? '浅色' : '深色'}
        </button>
      </div>
    </header>
  );
}

interface StatusPillProps {
  className?: string;
  icon: ReactNode;
  label: string;
  live?: boolean;
}

function StatusPill({ className = '', icon, label, live }: StatusPillProps) {
  return (
    <span className={`status-pill${className ? ` ${className}` : ''}`} role={live ? 'status' : undefined}>
      {icon}
      {label}
    </span>
  );
}

interface AssetPanelProps {
  assets: AssetReference[];
  maxAssets: number;
  onAssetLabel: (assetId: string, label: string) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onPreviewAsset: (asset: AssetReference) => void;
  onRemoveAsset: (assetId: string) => void;
}

function AssetPanel({
  assets,
  maxAssets,
  onAssetLabel,
  onDrop,
  onFileInput,
  onPreviewAsset,
  onRemoveAsset
}: AssetPanelProps) {
  const hasAssets = assets.length > 0;

  return (
    <section
      className={`workspace-panel asset-panel${hasAssets ? ' has-assets' : ''}`}
      aria-label="参考素材"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <PanelHeading title="参考素材" meta={`${assets.length}/${maxAssets}`} icon={<ImagePlus size={18} />} />
      <AssetDropzone compact={hasAssets} onDrop={onDrop} onFileInput={onFileInput} />
      <div className="asset-list" aria-label="参考素材列表">
        {assets.length === 0 ? (
          <div className="empty-state asset-empty">添加参考素材</div>
        ) : (
          assets.map((asset, index) => (
            <AssetCard
              asset={asset}
              index={index}
              key={asset.id}
              onAssetLabel={onAssetLabel}
              onPreviewAsset={onPreviewAsset}
              onRemoveAsset={onRemoveAsset}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface AssetDropzoneProps {
  compact: boolean;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
}

function AssetDropzone({ compact, onDrop, onFileInput }: AssetDropzoneProps) {
  return (
    <label
      className={`asset-dropzone${compact ? ' is-compact' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        onChange={onFileInput}
      />
      <ImagePlus size={compact ? 18 : 26} />
      <strong>{compact ? '继续添加' : '拖入或选择'}</strong>
    </label>
  );
}

interface AssetCardProps {
  asset: AssetReference;
  index: number;
  onAssetLabel: (assetId: string, label: string) => void;
  onPreviewAsset: (asset: AssetReference) => void;
  onRemoveAsset: (assetId: string) => void;
}

function AssetCard({ asset, index, onAssetLabel, onPreviewAsset, onRemoveAsset }: AssetCardProps) {
  const labelPrefix = getAssetLabelPrefix(asset.type, index);

  return (
    <article className="asset-card">
      <button
        aria-label={`放大预览 ${labelPrefix}`}
        className="asset-preview"
        type="button"
        onClick={() => onPreviewAsset(asset)}
      >
        <AssetPreview asset={asset} label={labelPrefix} />
      </button>
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

function AssetPreviewDialog({
  asset,
  onClose,
  theme
}: {
  asset: AssetReference;
  onClose: () => void;
  theme: ThemeMode;
}) {
  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return createPortal(
    <div className="asset-preview-backdrop" data-theme={theme} role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section className="asset-preview-dialog" aria-label="素材预览" aria-modal="true" role="dialog">
        <div className="asset-preview-dialog-head">
          <strong>{asset.localName}</strong>
          <button className="icon-button" type="button" aria-label="关闭素材预览" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="asset-preview-dialog-body">
          {asset.type === 'image' ? (
            <div className="asset-preview-media-box">
              <img alt={asset.localName} src={asset.previewUrl} />
            </div>
          ) : asset.type === 'video' ? (
            <div className="asset-preview-media-box">
              <video controls preload="metadata" src={asset.previewUrl} />
            </div>
          ) : (
            <audio controls src={asset.previewUrl} />
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

interface AssetPreviewProps {
  asset: AssetReference;
  label: string;
}

function AssetPreview({ asset, label }: AssetPreviewProps) {
  if (asset.type === 'image') {
    return <img alt="" aria-hidden="true" src={asset.previewUrl} />;
  }

  if (asset.type === 'video') {
    return <video aria-hidden="true" muted preload="metadata" src={asset.previewUrl} />;
  }

  return (
    <div className="audio-preview">
      <Film size={18} />
      <span>{label}</span>
    </div>
  );
}

interface PromptPanelProps {
  draft: WorkspaceState['draft'];
  onDraftField: (event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement>) => void;
  onPromptContextMenu: (event: MouseEvent<HTMLTextAreaElement>) => void;
}

function PromptPanel({ draft, onDraftField, onPromptContextMenu }: PromptPanelProps) {
  return (
    <section className="workspace-panel prompt-panel" aria-label="提示词区域">
      <label className="prompt-box">
        <span>提示词</span>
        <textarea
          aria-label="提示词"
          name="prompt"
          value={draft.prompt}
          onChange={onDraftField}
          onContextMenu={onPromptContextMenu}
          placeholder="写下画面、人物、动作、镜头和风格"
        />
      </label>
    </section>
  );
}

interface ModelControlsProps {
  draft: WorkspaceState['draft'];
  onDraftField: (event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement>) => void;
}

function ModelControls({ draft, onDraftField }: ModelControlsProps) {
  const defaultModel = getDefaultModelCapabilities();
  const selectableModels = Object.values(MODEL_CAPABILITIES).filter(
    (model) => model.submitMappingStatus === 'known'
  );

  return (
    <section className="control-grid" aria-label="模型参数">
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
      <label className="output-name-field">
        <span>文件名</span>
        <input
          aria-label="文件名"
          name="outputName"
          value={draft.outputName}
          onChange={onDraftField}
          placeholder="自动命名"
        />
      </label>
    </section>
  );
}

function PreviewPanel({ task }: { task: GenerationTask | null }) {
  return (
    <section className="workspace-panel preview-panel" aria-label="视频预览">
      <PanelHeading title="视频预览" meta={task ? getStatusText(task.status) : '等待'} icon={<Wand2 size={18} />} />
      <PreviewStage task={task} />
    </section>
  );
}

function PreviewStage({ task }: { task: GenerationTask | null }) {
  const src = task ? getPlayableVideoSource(task.localVideoPath ?? task.videoUrl) : null;
  const previewStyle = getPreviewAspectStyle(task?.ratio);

  if (task?.status === 'done' && src) {
    return (
      <div className="preview-stage" style={previewStyle}>
        <LocalVideoPlayer key={src} src={src} />
      </div>
    );
  }

  if (task) {
    return (
      <div className="preview-stage progress-preview" style={previewStyle}>
        <div className="preview-progress-card">
          <StatusIcon status={task.status} />
          <strong>{getStatusText(task.status)}</strong>
          <span>{task.prompt || task.finalPrompt || '生成任务'}</span>
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
          {task.errorMessage ? <p className="task-error-text">{task.errorMessage}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="preview-stage">
      <div className="preview-empty">生成后播放本地视频</div>
    </div>
  );
}

function LocalVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const syncEndState = useCallback(
    (video: HTMLVideoElement): boolean => {
      const endTime = Number.isFinite(video.duration) ? video.duration : duration;

      if (endTime <= 0 || (!video.ended && video.currentTime < endTime - 0.12)) {
        return false;
      }

      if (video.currentTime < endTime) {
        video.currentTime = endTime;
      }

      setDuration(endTime);
      setCurrentTime(endTime);
      return true;
    },
    [duration]
  );

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      const knownDuration = Number.isFinite(video.duration) ? video.duration : duration;
      if (video.ended || (knownDuration > 0 && video.currentTime >= knownDuration - 0.12)) {
        video.currentTime = 0;
        setCurrentTime(0);
      }

      void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
      return;
    }

    video.pause();
    setPaused(true);
  }, [duration]);

  const handleFrameKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleTogglePlay();
      }
    },
    [handleTogglePlay]
  );

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setCurrentTime(video.currentTime);
  }, []);

  const handleEnded = useCallback(() => {
    const video = videoRef.current;

    setPaused(true);
    if (video) {
      syncEndState(video);
    }
  }, [syncEndState]);

  const handlePause = useCallback(() => {
    const video = videoRef.current;

    setPaused(true);
    if (video) {
      syncEndState(video);
    }
  }, [syncEndState]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;

    if (video) {
      if (!syncEndState(video)) {
        setCurrentTime(video.currentTime);
      }
    }
  }, [syncEndState]);

  const handleSeek = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    const video = videoRef.current;

    if (video) {
      video.currentTime = nextTime;
    }

    setCurrentTime(nextTime);
  }, []);

  return (
    <div className="video-shell">
      <div
        aria-label="播放或暂停视频"
        className="video-frame"
        onClick={handleTogglePlay}
        onKeyDown={handleFrameKeyDown}
        role="button"
        tabIndex={0}
      >
        <div className="video-frame-media">
          <video
            aria-label="本地视频预览"
            onEnded={handleEnded}
            onLoadedMetadata={handleLoadedMetadata}
            onPause={handlePause}
            onPlay={() => setPaused(false)}
            onTimeUpdate={handleTimeUpdate}
            playsInline
            preload="metadata"
            ref={videoRef}
            src={src}
          />
        </div>
      </div>
      <div className="video-controls">
        <button type="button" onClick={handleTogglePlay} aria-label={paused ? '播放' : '暂停'}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
          {paused ? '播放' : '暂停'}
        </button>
        <span>{formatVideoTime(currentTime)}</span>
        <input
          aria-label="视频进度"
          className="video-seek"
          max={duration || 0}
          min={0}
          onChange={handleSeek}
          step="0.1"
          type="range"
          value={Math.min(currentTime, duration || currentTime)}
        />
        <span>{formatVideoTime(duration)}</span>
      </div>
    </div>
  );
}

interface CurrentTaskPanelProps {
  accounts: WorkspaceState['accounts'];
  onOpenVideo: (task: GenerationTask) => void;
  onRemoveTask: (taskId: string) => void;
  tasks: GenerationTask[];
}

function CurrentTaskPanel({
  accounts,
  onOpenVideo,
  onRemoveTask,
  tasks
}: CurrentTaskPanelProps) {
  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  return (
    <section className="workspace-panel current-task-panel" aria-label="当前任务">
      <PanelHeading icon={<Clock3 size={18} />} title="当前任务" meta={String(tasks.length)} />
      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="empty-state">生成后显示进度</div>
        ) : (
          tasks.map((task) => (
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
  );
}

interface HistoryPanelProps {
  onClearWorkspace: () => void;
  onOpenVideo: (task: GenerationTask) => void;
  onPlayTask: (task: GenerationTask) => void;
  onRemoveTask: (taskId: string) => void;
  onReuseTask: (task: GenerationTask) => void;
  tasks: GenerationTask[];
}

function HistoryPanel({
  onClearWorkspace,
  onOpenVideo,
  onPlayTask,
  onRemoveTask,
  onReuseTask,
  tasks
}: HistoryPanelProps) {
  return (
    <aside className="workspace-panel history-panel" aria-label="历史记录">
      <div className="history-head">
        <PanelHeading icon={<Film size={18} />} title="历史" meta={String(tasks.length)} />
        <span>本地记录</span>
      </div>
      <div className="history-list">
        {tasks.length === 0 ? (
          <div className="empty-state">完成后在这里查看</div>
        ) : (
          tasks.map((task) => (
            <HistoryItem
              key={task.id}
              onOpenVideo={onOpenVideo}
              onPlayTask={onPlayTask}
              onRemoveTask={onRemoveTask}
              onReuseTask={onReuseTask}
              task={task}
            />
          ))
        )}
      </div>
      <button className="small-button danger" type="button" onClick={onClearWorkspace}>
        <Trash2 size={15} />
        清除
      </button>
    </aside>
  );
}

interface HistoryItemProps {
  onOpenVideo: (task: GenerationTask) => void;
  onPlayTask: (task: GenerationTask) => void;
  onRemoveTask: (taskId: string) => void;
  onReuseTask: (task: GenerationTask) => void;
  task: GenerationTask;
}

function HistoryItem({
  onOpenVideo,
  onPlayTask,
  onRemoveTask,
  onReuseTask,
  task
}: HistoryItemProps) {
  const title = getTaskTitle(task);

  return (
    <article className="history-card">
      <button
        className="history-thumb-button"
        style={getPreviewAspectStyle(task.ratio)}
        type="button"
        onClick={() => onPlayTask(task)}
        aria-label="播放视频"
      >
        <HistoryThumbnail task={task} />
      </button>
      <button className="history-title-button" type="button" onClick={() => onOpenVideo(task)}>
        {title}
      </button>
      <div className="history-meta">
        <span>{formatDateLabel(task.createdAt)}</span>
        <span>{formatDurationLabel(task.duration)}</span>
        <span>{task.resolution}</span>
      </div>
      <div className="history-actions">
        <button type="button" onClick={() => onPlayTask(task)}>
          播放
        </button>
        <button type="button" onClick={() => onReuseTask(task)}>
          复用
        </button>
        <button type="button" onClick={() => onOpenVideo(task)}>
          打开
        </button>
        <button aria-label="删除历史" className="icon-button" onClick={() => onRemoveTask(task.id)} type="button">
          <X size={14} />
        </button>
      </div>
    </article>
  );
}

function HistoryThumbnail({ task }: { task: GenerationTask }) {
  const src = getPlayableVideoSource(task.localVideoPath ?? task.videoUrl);

  if (src) {
    return <VideoThumbnail src={src} />;
  }

  return (
    <div className="history-thumb-placeholder">
      <Film size={20} />
    </div>
  );
}

function VideoThumbnail({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;

    if (!video || video.readyState < 1) {
      return;
    }

    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.min(0.1, video.duration / 2);
    }
  }, []);

  return (
    <video
      aria-hidden
      muted
      onLoadedMetadata={handleLoadedMetadata}
      playsInline
      preload="metadata"
      ref={videoRef}
      src={src}
    />
  );
}

interface TaskItemProps {
  accountName: string;
  onOpenVideo: (task: GenerationTask) => void;
  onRemoveTask: (taskId: string) => void;
  task: GenerationTask;
}

function TaskItem({ accountName, onOpenVideo, onRemoveTask, task }: TaskItemProps) {
  const canOpen = Boolean(task.localVideoPath || task.videoUrl);
  const title = getTaskTitle(task);
  const compactTitle = truncateText(title, CURRENT_TASK_TITLE_LIMIT);

  return (
    <article className="task-item" data-status={task.status}>
      <div className="task-title">
        <strong title={title}>{compactTitle}</strong>
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

function StatusIcon({ status }: { status: GenerationTask['status'] }) {
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

function formatVideoTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDurationLabel(duration: string): string {
  return `${duration.replace(/s$/u, '')} 秒`;
}

function truncateText(value: string, maxLength: number): string {
  const characters = Array.from(value);

  if (characters.length <= maxLength) {
    return value;
  }

  return `${characters.slice(0, maxLength).join('')}...`;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getTaskTitle(task: GenerationTask): string {
  return task.prompt || task.outputName || task.finalPrompt || '未命名视频';
}

function getStatusText(status: GenerationTask['status']): string {
  const statusMap: Record<GenerationTask['status'], string> = {
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

function getPreviewAspectStyle(ratio: string | undefined): CSSProperties {
  return {
    '--preview-aspect': getPreviewAspectValue(ratio)
  } as CSSProperties;
}

function getPreviewAspectValue(ratio: string | undefined): string {
  const match = ratio?.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/u);

  if (!match) {
    return '9 / 16';
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return '9 / 16';
  }

  return `${width} / ${height}`;
}

function getPlayableVideoSource(target: string | null): string | null {
  if (!target) {
    return null;
  }

  if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('file://') || target.startsWith('data:')) {
    return target;
  }

  if (isWindowsAbsolutePath(target)) {
    return windowsPathToFileUrl(target);
  }

  if (target.startsWith('/')) {
    return `file://${encodePathSegments(target)}`;
  }

  return null;
}

function isWindowsAbsolutePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/u.test(value);
}

function windowsPathToFileUrl(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const drive = normalized.slice(0, 2);
  const rest = normalized.slice(2).split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return rest ? `file:///${drive}/${rest}` : `file:///${drive}/`;
}

function encodePathSegments(value: string): string {
  return value.split('/').map(encodeURIComponent).join('/');
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
            errorMessage: message,
            updatedAt: new Date().toISOString()
          }
        : task
    )
  };
}

function loadTheme(storage: StorageLike): ThemeMode {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
