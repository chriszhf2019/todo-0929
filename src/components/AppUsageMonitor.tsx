import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bot,
  ExternalLink,
  Home,
  LayoutGrid,
  Mic,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  NativeAppUsageSession,
  NativeCaptureStatus,
  VoxFlowNative,
  isNativeAndroid,
} from '../lib/nativeBridge';
import {
  ACTION_LABELS,
  executeTaskSteps,
  parseTask,
} from '../lib/taskCommands';

interface AppUsageMonitorProps {
  sessions: NativeAppUsageSession[];
  currentPackageName: string;
  accessibilityBound: boolean;
  nativeStatus: NativeCaptureStatus;
  onRefresh: () => Promise<void>;
  onClear: () => Promise<void>;
  onOpenAccessibilitySettings: () => void;
  onPerformAction: (
    action: string,
    options?: { x?: number; y?: number; packageName?: string; target?: string; delayMs?: number }
  ) => Promise<boolean>;
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  if (minutes < 60) return `${minutes} 分 ${seconds} 秒`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分`;
};

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));

export const AppUsageMonitor: React.FC<AppUsageMonitorProps> = ({
  sessions,
  currentPackageName,
  accessibilityBound,
  nativeStatus,
  onRefresh,
  onClear,
  onOpenAccessibilitySettings,
  onPerformAction,
}) => {
  const [command, setCommand] = useState('');
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [sessions]
  );

  const currentSession =
    sortedSessions.find((session) => session.packageName === currentPackageName) ??
    sortedSessions[0];

  const hints = useMemo(() => {
    const list: string[] = [];
    if (!isNativeAndroid) {
      list.push('当前为浏览器预览，安装到安卓设备后即可监控应用使用与执行操作。');
    } else if (!nativeStatus.accessibilityAccess || !accessibilityBound) {
      list.push('无障碍服务尚未启用，开启后才能读取前台应用与执行系统操作。');
    }
    if (currentSession) {
      const duration = formatDuration(
        currentSession.lastSessionDurationMs || currentSession.totalForegroundMs
      );
      list.push(`最近正在使用 ${currentSession.appName}，累计前台约 ${duration}。`);
      if (currentSession.lastTextSnippet) {
        list.push(`${currentSession.appName} 最后捕获：${currentSession.lastTextSnippet}`);
      }
    }
    if (sortedSessions.length > 1) {
      list.push(
        `近期活跃应用：${sortedSessions
          .slice(0, 4)
          .map((session) => session.appName || session.packageName)
          .join('、')}`
      );
    }
    if (list.length === 0) {
      list.push('暂无应用使用记录。打开其他聊天或办公应用，系统会自动记录。');
    }
    return list;
  }, [currentSession, sortedSessions, accessibilityBound, nativeStatus.accessibilityAccess]);

  const executeCommand = async (value: string) => {
    const steps = parseTask(value);
    if (steps.length === 0) {
      setMessage('未识别指令，可尝试：打开微信 然后 点击 搜索 然后 输入 张三');
      return;
    }
    setMessage(`开始执行，共 ${steps.length} 步`);
    const result = await executeTaskSteps(steps, onPerformAction, (index, step, success) => {
      setMessage(
        `第 ${index + 1} 步（${ACTION_LABELS[step.action]}）${success ? '完成' : '失败'}`
      );
    });
    if (result.success) {
      setMessage(`任务已完成，共 ${steps.length} 步`);
      setCommand('');
    } else {
      const failedStep = result.failedStep;
      setMessage(
        `任务执行中断：第 ${(result.failedIndex ?? 0) + 1} 步（${
          failedStep ? ACTION_LABELS[failedStep.action] : '未知'
        }）未完成`
      );
    }
  };

  const runAction = async (
    action: string,
    options?: { x?: number; y?: number; packageName?: string; target?: string; delayMs?: number }
  ) => {
    const success = await onPerformAction(action, options);
    setMessage(success ? '指令已执行' : '指令执行失败，请确认无障碍服务已开启');
  };

  const handleVoiceCommand = async () => {
    if (!isNativeAndroid) {
      setMessage('语音输入仅在实际安装的安卓应用中可用');
      return;
    }
    setIsListening(true);
    try {
      const result = await VoxFlowNative.startSpeechRecognition({ language: 'zh-CN' });
      const recognized = result?.text?.trim();
      if (recognized) {
        setCommand(recognized);
        setMessage('已识别，请确认后点击执行');
      } else {
        setMessage('没有识别到语音内容');
      }
    } catch {
      setMessage('语音识别未完成');
    } finally {
      setIsListening(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status & permissions */}
      {isNativeAndroid && (!nativeStatus.accessibilityAccess || !accessibilityBound) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-200">需要开启无障碍服务</p>
            <p className="text-xs text-amber-200/70">
              用于读取前台应用信息并执行返回、滑动、点击等系统操作。
            </p>
          </div>
          <button
            onClick={onOpenAccessibilitySettings}
            className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            去开启
          </button>
        </div>
      )}

      {/* Usage ledger */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white">应用使用监控</h2>
            <span className="text-xs text-slate-500">{sortedSessions.length} 个应用</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onClear()}
              className="text-slate-400 hover:text-rose-300 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 p-2 rounded-xl transition-colors cursor-pointer"
              title="清空使用记录"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => void onRefresh()}
              className="text-slate-300 hover:text-emerald-300 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/30 p-2 rounded-xl transition-colors cursor-pointer"
              title="刷新使用记录"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {sortedSessions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">还没有前台应用记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedSessions.slice(0, 8).map((session) => {
              const isCurrent = session.packageName === currentPackageName;
              return (
                <div
                  key={session.packageName}
                  className={`rounded-xl border p-3.5 space-y-2 ${
                    isCurrent
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-slate-800 bg-slate-950/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">
                          {session.appName || session.packageName}
                        </p>
                        {isCurrent && (
                          <span className="shrink-0 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                            前台
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {session.packageName} · {formatTime(session.lastSeenAt)}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        void runAction('openApp', { packageName: session.packageName })
                      }
                      className="shrink-0 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      打开
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>事件 {session.eventCount} 次</span>
                    <span>{formatDuration(session.totalForegroundMs || session.lastSessionDurationMs)}</span>
                  </div>
                  {session.lastTextSnippet && (
                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">
                      {session.lastTextSnippet}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Smart hints */}
      <section className="rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-300" />
          <h2 className="text-base font-bold text-white">智能提示</h2>
        </div>
        <ul className="space-y-2">
          {hints.map((hint, index) => (
            <li
              key={index}
              className="text-xs text-slate-300 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 leading-relaxed"
            >
              {hint}
            </li>
          ))}
        </ul>
      </section>

      {/* Command executor */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-300" />
          <h2 className="text-base font-bold text-white">执行任务</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void handleVoiceCommand()}
            disabled={isListening}
            className={`shrink-0 bg-slate-950 hover:bg-slate-800 border border-slate-800 p-2.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              isListening ? 'text-rose-300 border-rose-500/40' : 'text-slate-300'
            }`}
            title="语音输入任务"
          >
            <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
          </button>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void executeCommand(command);
            }}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
            placeholder="输入任务，如：打开微信 然后 点击 搜索 然后 输入 张三"
          />
          <button
            onClick={() => void executeCommand(command)}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            执行
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: '返回', action: 'back', icon: ArrowLeft },
            { label: '桌面', action: 'home', icon: Home },
            { label: '最近任务', action: 'recents', icon: LayoutGrid },
            { label: '上滑', action: 'scrollUp', icon: ArrowUp },
            { label: '下滑', action: 'scrollDown', icon: ArrowDown },
          ].map(({ label, action, icon: Icon }) => (
            <button
              key={action}
              onClick={() => void runAction(action)}
              className="text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {message && (
          <p className="text-xs text-slate-400 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">
            {message}
          </p>
        )}
      </section>
    </div>
  );
};
