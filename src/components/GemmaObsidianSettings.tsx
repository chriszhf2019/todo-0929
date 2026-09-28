import React, { useState } from 'react';
import { 
  Cpu, 
  BookOpen, 
  Cat,
  ShieldCheck, 
  Sparkles, 
  Server, 
  Zap, 
  Check, 
  RefreshCw, 
  FolderSync, 
  ExternalLink,
  HelpCircle,
  HardDrive,
  Settings2,
  Lock,
  Terminal,
  Smartphone,
  RotateCcw,
  Database,
  Bell,
  Mic,
  PhoneCall,
  Radio,
  Download,
  Upload,
  ScanText
} from 'lucide-react';
import { GemmaConfig, ObsidianConfig } from '../types';
import { APP_NAMING_PROPOSALS } from '../data/mockPresets';
import { NativeCaptureStatus, OnDeviceModelStatus, DEFAULT_ON_DEVICE_MODEL_URL } from '../lib/nativeBridge';
import { pingOllama } from '../lib/localModel';

interface GemmaObsidianSettingsProps {
  gemmaConfig: GemmaConfig;
  onUpdateGemmaConfig: (cfg: Partial<GemmaConfig>) => void;
  obsidianConfig: ObsidianConfig;
  onUpdateObsidianConfig: (cfg: Partial<ObsidianConfig>) => void;
  onResetWorkspace: () => void;
  nativeStatus: NativeCaptureStatus;
  isNativeSyncing: boolean;
  onRefreshNativeStatus: () => Promise<void>;
  onRequestNativePermissions: () => Promise<void>;
  onOpenNotificationSettings: () => Promise<void>;
  onOpenAccessibilitySettings: () => Promise<void>;
  onSyncNativeData: () => Promise<void>;
  onSetDesktopPetEnabled: (enabled: boolean) => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => Promise<void>;
  onDeviceModel: OnDeviceModelStatus;
  onRefreshOnDeviceModel: () => Promise<void>;
  onDownloadOnDeviceModel: (url: string) => Promise<void>;
  initialTab?: string;
}

export const GemmaObsidianSettings: React.FC<GemmaObsidianSettingsProps> = ({
  gemmaConfig,
  onUpdateGemmaConfig,
  obsidianConfig,
  onUpdateObsidianConfig,
  onResetWorkspace,
  nativeStatus,
  isNativeSyncing,
  onRefreshNativeStatus,
  onRequestNativePermissions,
  onOpenNotificationSettings,
  onOpenAccessibilitySettings,
  onSyncNativeData,
  onSetDesktopPetEnabled,
  onExportBackup,
  onImportBackup,
  onDeviceModel,
  onRefreshOnDeviceModel,
  onDownloadOnDeviceModel,
  initialTab = 'system',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'system' | 'gemma' | 'obsidian' | 'naming'>(
    (initialTab as any) || 'system'
  );
  const [isPinging, setIsPinging] = useState(false);
  const [pingMessage, setPingMessage] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState(DEFAULT_ON_DEVICE_MODEL_URL);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
  };

  const onDeviceStateLabel = (state: OnDeviceModelStatus['state']) => {
    switch (state) {
      case 'not_downloaded':
        return '未下载';
      case 'downloading':
        return '下载中';
      case 'not_loaded':
        return '已下载';
      case 'loading':
        return '加载中';
      case 'ready':
        return '就绪';
      case 'error':
        return '错误';
      default:
        return state;
    }
  };

  const handlePingGemma = async () => {
    setIsPinging(true);
    setPingMessage(null);
    try {
      const models = await pingOllama(gemmaConfig.localEndpoint);
      const configuredTag = gemmaConfig.modelTag.trim();
      const hasConfiguredModel = configuredTag
        ? models.some((name) => name === configuredTag)
        : false;

      let message: string;
      let connected = false;
      if (models.length === 0) {
        message = '连接成功，但当前没有已安装模型';
      } else if (!hasConfiguredModel) {
        message = `已连接，但未找到模型「${configuredTag}」，当前可用：${models.join('、')}`;
      } else {
        message = `连接成功，模型「${configuredTag}」可用`;
        connected = true;
      }

      setPingMessage(message);
      onUpdateGemmaConfig({ isConnected: connected, lastPingStatus: message });
    } catch {
      setPingMessage('未检测到本地 Ollama 服务，将继续使用离线规则引擎');
      onUpdateGemmaConfig({
        isConnected: false,
        lastPingStatus: '未检测到本地模型服务',
      });
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>核心系统配置：本地 AI、系统接入与 Obsidian</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            所有未配置云端的提取都可在本机完成；本地模型、系统权限和 Obsidian 导出均由你主动选择
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('system')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'system'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>系统真实接入</span>
          </button>

          <button
            onClick={() => setActiveSubTab('gemma')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'gemma'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>本地模型配置</span>
          </button>

          <button
            onClick={() => setActiveSubTab('obsidian')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'obsidian'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Obsidian 库联动</span>
          </button>

          <button
            onClick={() => setActiveSubTab('naming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'naming'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>起名建议库</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'system' && (
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 rounded-2xl p-4 sm:p-5 border border-emerald-500/30">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3" />
              <span>仅在你授权后读取真实系统数据</span>
            </div>
            <h3 className="text-base font-bold text-white mt-2">安卓系统信息捕获</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
              通过系统通知使用权读取短信与微信通知，通过通话记录权限同步来电信息。普通安卓应用无法读取微信聊天数据库，也无法在系统限制下录制双方通话音频。
            </p>
          </div>

          {!nativeStatus.isNativeAndroid && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              当前是网页预览环境。安装 APK 后，这里会显示真实权限状态并允许同步系统记录。
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <Bell className="w-5 h-5 text-indigo-400" />
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    nativeStatus.notificationAccess ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
              </div>
              <h4 className="text-sm font-semibold text-white mt-3">短信 / 微信通知</h4>
              <p className="text-[11px] text-slate-400 mt-1 min-h-8">
                需要“通知使用权”，仅保存消息标题与通知正文。
              </p>
              <button
                onClick={() => void onOpenNotificationSettings()}
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 px-3 py-2 transition-colors cursor-pointer"
              >
                {nativeStatus.notificationAccess ? '已授权，打开设置' : '去授权通知使用权'}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <Mic className="w-5 h-5 text-teal-400" />
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    nativeStatus.microphonePermission ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
              </div>
              <h4 className="text-sm font-semibold text-white mt-3">麦克风语音识别</h4>
              <p className="text-[11px] text-slate-400 mt-1 min-h-8">
                使用系统识别服务，将现场语音转成待整理的文字。
              </p>
              <button
                onClick={() => void onRequestNativePermissions()}
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 px-3 py-2 transition-colors cursor-pointer"
              >
                {nativeStatus.microphonePermission ? '麦克风已授权' : '申请麦克风权限'}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <PhoneCall className="w-5 h-5 text-blue-400" />
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    nativeStatus.callLogPermission ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
              </div>
              <h4 className="text-sm font-semibold text-white mt-3">系统通话记录</h4>
              <p className="text-[11px] text-slate-400 mt-1 min-h-8">
                同步号码、联系人、呼入呼出类型与通话时长。
              </p>
              <button
                onClick={() => void onRequestNativePermissions()}
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 px-3 py-2 transition-colors cursor-pointer"
              >
                {nativeStatus.callLogPermission ? '通话记录已授权' : '申请通话记录权限'}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <ScanText className="w-5 h-5 text-purple-400" />
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    nativeStatus.accessibilityAccess ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
              </div>
              <h4 className="text-sm font-semibold text-white mt-3">屏幕内容读取</h4>
              <p className="text-[11px] text-slate-400 mt-1 min-h-8">
                读取前台聊天 App 的屏幕文字，节点读不到时用离线 OCR 兜底。首次开启后需关掉再开一次，截屏识别才生效。
              </p>
              <button
                onClick={() => void onOpenAccessibilitySettings()}
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 px-3 py-2 transition-colors cursor-pointer"
              >
                {nativeStatus.accessibilityAccess ? '已授权，打开设置' : '开启屏幕内容读取'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Cat className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">常驻桌宠浮窗</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    一个小巧的猫猫会常驻屏幕角落，可拖动位置。当来电、打开微信 / QQ / 短信 / 电话，或通话结束时，它会展开成提示卡片；点击“查看”可回到记言 Todo。
                  </p>
                </div>
              </div>
              <button
                onClick={() => void onSetDesktopPetEnabled(!nativeStatus.desktopPetEnabled)}
                disabled={!nativeStatus.isNativeAndroid}
                aria-pressed={nativeStatus.desktopPetEnabled}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                  nativeStatus.desktopPetEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    nativeStatus.desktopPetEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <p className="text-[11px] text-slate-500 max-w-2xl">
              为了避免将系统状态误报成已经完成的能力，这里不会声称支持通话双方录音、微信数据库读取或未经授权的短信拦截。
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void onRefreshNativeStatus()}
                className="rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs px-3 py-2 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>刷新状态</span>
              </button>
              <button
                onClick={() => void onSyncNativeData()}
                disabled={isNativeSyncing || !nativeStatus.isNativeAndroid}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold px-4 py-2 transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isNativeSyncing ? 'animate-spin' : ''}`} />
                <span>{isNativeSyncing ? '正在同步...' : '同步真实系统记录'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemma 4 Settings Panel */}
      {activeSubTab === 'gemma' && (
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 space-y-6">
          
          {/* Architecture Concept Card */}
          <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 rounded-2xl p-4 sm:p-5 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                <Lock className="w-3 h-3 text-indigo-400" />
                <span>默认端侧处理 · 云端功能需主动配置</span>
              </div>
              <h3 className="text-base font-bold text-white">
                本地模型、离线规则引擎与系统语音能力
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                未连接模型时，应用会使用共享的端侧规则引擎从授权通知、通话记录和手动输入中提取待办。连接局域网 Ollama 后，可进一步使用你配置的 Gemma 或其他指令模型；应用不会把未连接的模型虚报为已运行。
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                本地加密沙盒激活
              </span>
            </div>
          </div>

          {/* On-device Gemma model (MediaPipe LLM Inference) */}
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  <Smartphone className="w-3 h-3" />
                  <span>手机本地推理 · MediaPipe LLM Inference</span>
                </div>
                <h3 className="text-base font-bold text-white">端侧 Gemma 模型</h3>
                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  模型真正跑在手机本地，不联网、不依赖电脑。模型约 2GB，首次使用需下载；提取与翻译会优先走端侧，未就绪时自动回退到本地 Ollama / Gemini / 规则引擎。
                </p>
              </div>
              <span
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                  onDeviceModel.state === 'ready'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : onDeviceModel.state === 'error'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {onDeviceStateLabel(onDeviceModel.state)}
              </span>
            </div>

            {onDeviceModel.state === 'downloading' && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-mono">
                  已下载 {formatBytes(onDeviceModel.downloadedBytes)} / {formatBytes(onDeviceModel.totalBytes)}
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${
                        onDeviceModel.totalBytes > 0
                          ? Math.min(100, (onDeviceModel.downloadedBytes / onDeviceModel.totalBytes) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {onDeviceModel.downloaded && onDeviceModel.modelSizeBytes > 0 && (
              <p className="text-[11px] text-slate-500 font-mono">
                模型大小 {formatBytes(onDeviceModel.modelSizeBytes)}
              </p>
            )}

            {onDeviceModel.errorMessage && (
              <p className="text-[11px] text-rose-300">错误：{onDeviceModel.errorMessage}</p>
            )}

            <div>
              <label className="text-xs text-slate-300 font-medium mb-1 block">
                模型下载地址（.task 直链）
              </label>
              <input
                type="text"
                value={modelUrl}
                onChange={(e) => setModelUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                placeholder="https://.../gemma-2b-it-gpu-int4.task"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                官方模型在 Kaggle（需登录下载后自行托管到手机可达地址）
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => void onDownloadOnDeviceModel(modelUrl)}
                disabled={onDeviceModel.state === 'ready' || onDeviceModel.state === 'downloading' || !modelUrl.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {onDeviceModel.state === 'ready'
                    ? '模型已就绪'
                    : onDeviceModel.state === 'downloading'
                    ? '下载中…'
                    : '下载端侧模型'}
                </span>
              </button>
              <button
                onClick={() => void onRefreshOnDeviceModel()}
                className="text-slate-300 hover:text-emerald-300 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/30 text-xs font-medium px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>刷新状态</span>
              </button>
            </div>
          </div>

          {/* Inference Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              AI 推理管道运行模式 (Inference Engine Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => onUpdateGemmaConfig({ mode: 'local_gemma' })}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  gemmaConfig.mode === 'local_gemma'
                    ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">纯本地模式</span>
                  {gemmaConfig.mode === 'local_gemma' && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  不出境、不调用云端，直接使用设备规则或你配置的本地 Ollama。
                </p>
              </div>

              <div
                onClick={() => onUpdateGemmaConfig({ mode: 'hybrid' })}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  gemmaConfig.mode === 'hybrid'
                    ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">混合模式 (推荐)</span>
                  {gemmaConfig.mode === 'hybrid' && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  优先本地处理；只有配置了服务端 Gemini 密钥时才使用云端增强。
                </p>
              </div>

              <div
                onClick={() => onUpdateGemmaConfig({ mode: 'cloud_gemini' })}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  gemmaConfig.mode === 'cloud_gemini'
                    ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">云端模式 (Gemini)</span>
                  {gemmaConfig.mode === 'cloud_gemini' && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  需要服务端配置 GEMINI_API_KEY；APK 本身不会内置或暴露密钥。
                </p>
              </div>
            </div>
          </div>

          {/* Local Parameters Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs text-slate-300 font-medium mb-1 block">
                端侧/本地模型端点 (Local Endpoint / Ollama API)
              </label>
              <input
                type="text"
                value={gemmaConfig.localEndpoint}
                onChange={(e) => onUpdateGemmaConfig({ localEndpoint: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                placeholder="http://localhost:11434"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                支持安卓手机本地端口、家庭局域网 Ollama 服务或 Termux 上的 llama.cpp 实例
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium mb-1 block">
                指定 Ollama 模型标签 (Model Tag)
              </label>
              <input
                type="text"
                value={gemmaConfig.modelTag}
                onChange={(e) => onUpdateGemmaConfig({ modelTag: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                placeholder="gemma4:instruct"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                推荐：<code className="text-indigo-400">gemma4:instruct</code> 或 <code className="text-indigo-400">gemma-4-mobile-q4</code>
              </p>
            </div>
          </div>

          {/* Gemini API Key（手机直连云端判别） */}
          <div className="pt-2">
            <label className="text-xs text-slate-300 font-medium mb-1 block">
              Gemini API Key（手机直连云端判别，可选）
            </label>
            <input
              type="password"
              value={gemmaConfig.geminiApiKey || ''}
              onChange={(e) => onUpdateGemmaConfig({ geminiApiKey: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              placeholder="AIza...（从 aistudio.google.com 获取）"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              填 key 后，云端/混合模式下手机直接调 Gemini 判别「哪些需要跟进」，不需要电脑。key 仅存本机。
            </p>
          </div>

          {/* Ping Test Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              {pingMessage && (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {pingMessage}
                </span>
              )}
            </div>

            <button
              onClick={handlePingGemma}
              disabled={isPinging}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? '测试连通中...' : '测试本地 Ollama 连接'}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-200">本机数据与隐私</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  待办、笔记与配置仅保存在当前设备，恢复演示数据不会影响其他设备。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => void onExportBackup()}
                className="text-slate-300 hover:text-emerald-300 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/30 text-xs font-medium px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>导出备份</span>
              </button>
              <button
                onClick={() => void onImportBackup()}
                className="text-slate-300 hover:text-indigo-300 bg-slate-950 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/30 text-xs font-medium px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>导入备份</span>
              </button>
              <button
                onClick={onResetWorkspace}
                className="text-slate-300 hover:text-rose-300 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-xs font-medium px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>恢复演示数据</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Obsidian Settings Panel */}
      {activeSubTab === 'obsidian' && (
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 space-y-6">
          <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 rounded-2xl p-4 sm:p-5 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                <BookOpen className="w-3 h-3 text-purple-400" />
                <span>Obsidian 第二大脑无缝融合</span>
              </div>
              <h3 className="text-base font-bold text-white">
                将零散通讯转化为双链知识图谱
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                每一条通过记言 Todo 整理后的通话记录、短信或微信群备忘，都会按照 Obsidian 规范自动生成标准 Markdown 笔记，内置 YAML Frontmatter 属性标签、任务待办语法 <code className="text-purple-300 font-mono">- [ ]</code>，以及与联系人、项目建立的双向链接。
              </p>
            </div>
          </div>

          {/* Form Settings for Obsidian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-300 font-medium mb-1 block">
                Obsidian Vault 库名称 (Vault Name)
              </label>
              <input
                type="text"
                value={obsidianConfig.vaultName}
                onChange={(e) => onUpdateObsidianConfig({ vaultName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                placeholder="例如: MyVault / KnowledgeBase"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                与您在 Obsidian 桌面端或安卓端创建的 Vault 名称一致
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium mb-1 block">
                知识库沉淀归档子目录 (Notes Folder)
              </label>
              <input
                type="text"
                value={obsidianConfig.notesFolder}
                onChange={(e) => onUpdateObsidianConfig({ notesFolder: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                placeholder="例如: Inbox/记言Todo/"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                导出的通话纪要与短信整理笔记将存入此文件夹
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium mb-1 block">
                每日待办汇总归档目录 (Daily Notes Folder)
              </label>
              <input
                type="text"
                value={obsidianConfig.dailyNotesFolder}
                onChange={(e) => onUpdateObsidianConfig({ dailyNotesFolder: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                placeholder="DailyNotes/"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                点击“汇总至 Obsidian 日记”时更新的目标路径
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium mb-1 block">
                双链与深链协议设置
              </label>
              <div className="space-y-2 pt-1 text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={obsidianConfig.autoWikilinks}
                    onChange={(e) => onUpdateObsidianConfig({ autoWikilinks: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-0 bg-slate-950 border-slate-800"
                  />
                  <span>自动将对话方转为 <code className="text-purple-300 font-mono">[[联系人/姓名]]</code> 双向链接</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={obsidianConfig.deepLinkProtocol}
                    onChange={(e) => onUpdateObsidianConfig({ deepLinkProtocol: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-0 bg-slate-950 border-slate-800"
                  />
                  <span>启用 <code className="text-purple-300 font-mono">obsidian://new</code> 协议一键唤起 Obsidian 客户端</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sample Obsidian Template Preview */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-purple-400 block font-mono">
              导出的标准 Obsidian 格式范式示例:
            </span>
            <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
{`---
title: "与海外客户关于合同交付的通话纪要"
date: 2026-09-22
source: "phone_live_translation"
caller: "Alex Davies"
model: "gemma4-instruct"
tags:
  - "#待办/SLA"
  - "#通话/英文"
status: "processed"
---

# 📞 通话纪要：与 [[联系人/Alex Davies]]

- [ ] #高优 **向 Alex 发送修订版 SLA 服务协议与更新后发票** 📅 2026-09-29 17:00
- [ ] #中优 **预约技术主管 Marcus 的 30 分钟联调对齐会议** 📅 2026-09-24

> 原文引用: "Please send us the revised SLA contract document..."`}
            </pre>
          </div>
        </div>
      )}

      {/* App Naming Proposals Library */}
      {activeSubTab === 'naming' && (
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-white">
              应用起名建议与定位推演
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              您在需求中提到“起个名字”，这里为您定制的 4 组精品产品命名方案，涵盖从轻量工具到专业生产力中枢的各种定位：
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {APP_NAMING_PROPOSALS.map((opt, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-2.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-base font-bold text-white">{opt.chineseName}</h4>
                    <span className="text-xs font-mono font-semibold text-indigo-400">{opt.englishName}</span>
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                      当前采用
                    </span>
                  )}
                </div>

                <p className="text-xs text-amber-300 font-medium italic">“{opt.tagline}”</p>

                <div className="text-xs text-slate-300 space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <p><span className="text-slate-400">心智风格:</span> {opt.vibe}</p>
                  <p><span className="text-slate-400">定位契合:</span> {opt.recommendedRole}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
