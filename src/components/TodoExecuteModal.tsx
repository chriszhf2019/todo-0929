import React, { useEffect, useState } from 'react';
import { Bot, Check, Mic, Play, RotateCcw, X } from 'lucide-react';
import { ExtractedTodo } from '../types';
import { VoxFlowNative, isNativeAndroid } from '../lib/nativeBridge';
import {
  ACTION_LABELS,
  APP_PACKAGES,
  DEFAULT_DINING_PREFERENCES,
  buildDiningPlan,
  buildTodoTask,
  isRestaurantTodo,
  parseTask,
  type DiningPreferences,
  type PerformAction,
  type TaskStep,
} from '../lib/taskCommands';

interface TodoExecuteModalProps {
  todo: ExtractedTodo | null;
  onClose: () => void;
  onPerformAction: PerformAction;
  onDone: (todo: ExtractedTodo) => void;
}

const SCREEN_NOISE =
  /好评|人均|收藏|买单|点评|搜索|筛选|附近|推荐|广告|登录|注册|消息|通讯录|发现|设置|返回|更多|发送|元起|km|千米/;

const packageLabel = (packageName?: string) => {
  if (!packageName) return '应用';
  return Object.entries(APP_PACKAGES).find(([, value]) => value === packageName)?.[0] ?? packageName;
};

const stepToText = (step: TaskStep) => {
  switch (step.action) {
    case 'openApp':
      return `打开 ${packageLabel(step.packageName)}`;
    case 'findAndTap':
      return `点击 ${step.target || '目标'}`;
    case 'typeText':
      return `输入 ${step.target || ''}`;
    case 'tap':
      return `点击 ${step.x ?? 0}, ${step.y ?? 0}`;
    case 'wait':
      return `等待 ${Math.max(0, Math.round((step.delayMs || 0) / 1000))} 秒`;
    case 'scrollUntilText':
      return `滚动到 ${step.target || ''}`;
    default:
      return ACTION_LABELS[step.action];
  }
};

const buildInitialSteps = (todo: ExtractedTodo, preferences: DiningPreferences): TaskStep[] =>
  isRestaurantTodo(todo.title)
    ? buildDiningPlan(preferences, todo)
    : buildTodoTask(todo);

export const TodoExecuteModal: React.FC<TodoExecuteModalProps> = ({
  todo,
  onClose,
  onPerformAction,
  onDone,
}) => {
  const [command, setCommand] = useState('');
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [message, setMessage] = useState('');
  const [executing, setExecuting] = useState(false);
  const [listening, setListening] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<DiningPreferences>(DEFAULT_DINING_PREFERENCES);
  const [screenOptions, setScreenOptions] = useState<string[]>([]);
  const [loadingScreen, setLoadingScreen] = useState(false);

  useEffect(() => {
    if (!todo) return;
    const initialSteps = buildInitialSteps(todo, DEFAULT_DINING_PREFERENCES);
    setPreferences(DEFAULT_DINING_PREFERENCES);
    setSteps(initialSteps);
    setCommand(initialSteps.map(stepToText).join(' 然后 '));
    setMessage(isRestaurantTodo(todo.title) ? '这是建议的执行计划，你可以先调整偏好，再逐步确认执行。' : '');
    setExecuting(false);
    setCurrentStep(0);
    setScreenOptions([]);
  }, [todo]);

  const resetToCurrentTodo = (nextPreferences = preferences) => {
    if (!todo) return;
    const initialSteps = buildInitialSteps(todo, nextPreferences);
    setSteps(initialSteps);
    setCommand(initialSteps.map(stepToText).join(' 然后 '));
    setCurrentStep(0);
    setMessage('');
  };

  const handleCommandChange = (value: string) => {
    setCommand(value);
    const parsed = parseTask(value);
    setSteps(parsed.length > 0 ? parsed : todo ? buildInitialSteps(todo, preferences) : []);
    setCurrentStep(0);
    setMessage('');
  };

  const updatePreference = (patch: Partial<DiningPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    if (todo && isRestaurantTodo(todo.title)) {
      const plan = buildDiningPlan(next, todo);
      setSteps(plan);
      setCommand(plan.map(stepToText).join(' 然后 '));
      setCurrentStep(0);
      setMessage('已根据偏好更新搜索计划');
    }
  };

  const refreshScreenOptions = async () => {
    if (!isNativeAndroid) {
      setScreenOptions([]);
      setMessage('浏览器预览无法读取手机屏幕，请安装到安卓设备后再试');
      return;
    }
    setLoadingScreen(true);
    try {
      const result = await VoxFlowNative.getCurrentScreenText();
      const unique = Array.from(
        new Set(
          (result?.lines || [])
            .map((line) => line.trim())
            .filter(
              (line) =>
                line.length >= 2 &&
                line.length <= 24 &&
                !/^\d+(\.\d+)?$/.test(line) &&
                !SCREEN_NOISE.test(line)
            )
        )
      ).slice(0, 12);
      setScreenOptions(unique);
      if (unique.length === 0) {
        setMessage('已执行搜索，但没有读到候选结果，请确认当前已打开大众点评结果页');
      }
    } catch {
      setScreenOptions([]);
      setMessage('读取屏幕结果失败，请确认无障碍服务已开启');
    } finally {
      setLoadingScreen(false);
    }
  };

  const selectScreenOption = (option: string) => {
    setSteps([{ action: 'findAndTap', target: option }]);
    setCommand(`点击 ${option}`);
    setCurrentStep(0);
    setScreenOptions([]);
    setMessage('已选择候选，请确认第 1 步');
  };

  const executeNextStep = async () => {
    if (!todo || executing || steps.length === 0) return;
    if (currentStep >= steps.length) return;

    const step = steps[currentStep];
    setExecuting(true);
    setMessage(`正在执行第 ${currentStep + 1} 步：${stepToText(step)}`);
    const success = await onPerformAction(step.action, {
      x: step.x,
      y: step.y,
      packageName: step.packageName,
      target: step.target,
      delayMs: step.delayMs,
    });
    setExecuting(false);

    if (!success) {
      setMessage(`第 ${currentStep + 1} 步未完成，请检查无障碍服务后重试`);
      return;
    }

    const next = currentStep + 1;
    setCurrentStep(next);
    if (next >= steps.length) {
      if (isRestaurantTodo(todo.title)) {
        setMessage('正在读取搜索结果...');
        await refreshScreenOptions();
      } else {
        onDone(todo);
      }
    } else {
      setMessage(`第 ${next} 步完成，请确认第 ${next + 1} 步`);
    }
  };

  const handleVoice = async () => {
    if (!todo) return;
    if (!isNativeAndroid) {
      setMessage('语音输入仅在实际安装的安卓应用中可用');
      return;
    }
    setListening(true);
    try {
      const result = await VoxFlowNative.startSpeechRecognition({ language: 'zh-CN' });
      const recognized = result?.text?.trim();
      if (recognized) {
        const parsed = parseTask(recognized);
        if (parsed.length === 0) {
          setCommand(recognized);
          setSteps(buildInitialSteps(todo, preferences));
          setCurrentStep(0);
          setMessage('没有识别到可执行指令');
        } else {
          setCommand(recognized);
          setSteps(parsed);
          setCurrentStep(0);
          setMessage('已识别，请确认第 1 步');
        }
      } else {
        setMessage('没有识别到语音内容');
      }
    } catch {
      setMessage('语音识别未完成');
    } finally {
      setListening(false);
    }
  };

  if (!todo) return null;

  const dining = isRestaurantTodo(todo.title);
  const allStepsDone = currentStep >= steps.length;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60 p-5 space-y-4 max-h-[86vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-4 h-4 text-purple-300 shrink-0" />
            <h2 className="text-base font-bold text-white truncate">执行待办</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
          <p className="text-sm font-semibold text-white">{todo.title}</p>
          <p className="text-xs text-slate-400">
            来源：{todo.sender || '手动'}
            {todo.senderPhone ? ` · ${todo.senderPhone}` : ''}
            {' · '}
            {todo.channel === 'wechat' ? '聊天' : todo.channel === 'sms' ? '短信' : '电话'}
          </p>
        </div>

        {dining && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 space-y-3">
            <p className="text-xs font-semibold text-indigo-300">聚餐偏好</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-400 space-y-1">
                人数
                <select
                  value={preferences.people}
                  onChange={(event) => updatePreference({ people: event.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
                >
                  {['2', '4', '6', '8', '10'].map((value) => (
                    <option key={value} value={value}>{value} 人</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-slate-400 space-y-1">
                口味
                <select
                  value={preferences.cuisine}
                  onChange={(event) => updatePreference({ cuisine: event.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
                >
                  {['不限', '粤菜', '川菜', '火锅', '日料', '西餐', '烧烤', '本帮菜'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-slate-400 space-y-1">
                预算
                <select
                  value={preferences.budget}
                  onChange={(event) => updatePreference({ budget: event.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
                >
                  {['不限', '人均 50', '人均 100', '人均 200', '人均 500'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-slate-400 space-y-1">
                位置
                <select
                  value={preferences.location}
                  onChange={(event) => updatePreference({ location: event.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
                >
                  {['附近', '公司', '家', '不限'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => void handleVoice()}
            disabled={listening || executing}
            className={`shrink-0 bg-slate-950 hover:bg-slate-800 border border-slate-800 p-2.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
              listening ? 'text-rose-300 border-rose-500/40' : 'text-slate-300'
            }`}
            title="语音输入执行指令"
          >
            <Mic className={`w-4 h-4 ${listening ? 'animate-pulse' : ''}`} />
          </button>
          <input
            value={command}
            onChange={(event) => handleCommandChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void executeNextStep();
            }}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
            placeholder="执行指令"
          />
          <button
            onClick={() => void executeNextStep()}
            disabled={executing || steps.length === 0 || allStepsDone}
            className="shrink-0 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            {allStepsDone ? '已执行完' : `确认第 ${currentStep + 1} 步`}
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400">执行步骤预览</p>
            <button
              onClick={() => resetToCurrentTodo()}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors cursor-pointer"
              title="重新开始"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {steps.length === 0 ? (
              <p className="text-xs text-slate-500">未识别到可执行步骤，请补充“点击 / 输入 / 打开”等指令。</p>
            ) : (
              steps.map((step, index) => {
                const done = index < currentStep;
                const current = index === currentStep;
                return (
                  <div
                    key={`${step.action}-${index}`}
                    className={`flex items-center gap-2 text-xs rounded-lg border px-2.5 py-1.5 ${
                      done
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                        : current
                        ? 'text-white bg-purple-500/10 border-purple-500/30'
                        : 'text-slate-400 bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <span className="w-5 h-5 shrink-0 rounded-full bg-slate-800 text-slate-200 text-[10px] flex items-center justify-center font-mono">
                      {done ? <Check className="w-3 h-3" /> : index + 1}
                    </span>
                    <span>{stepToText(step)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {screenOptions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-400">候选结果</p>
              {loadingScreen && <span className="text-[10px] text-slate-500">读取中...</span>}
              <button
                onClick={() => void refreshScreenOptions()}
                className="ml-auto text-[11px] text-purple-300 hover:text-purple-200"
              >
                重新读取屏幕
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {screenOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => selectScreenOption(option)}
                  className="text-xs text-slate-200 bg-slate-950 hover:bg-purple-500/10 border border-slate-700 hover:border-purple-500/40 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {message && (
          <p className="text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">{message}</p>
        )}

        {(allStepsDone || dining) && (
          <button
            onClick={() => void refreshScreenOptions()}
            disabled={loadingScreen}
            className="w-full text-xs text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl px-3 py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loadingScreen ? '正在读取屏幕...' : '读取当前屏幕候选'}
          </button>
        )}
      </div>
    </div>
  );
};
