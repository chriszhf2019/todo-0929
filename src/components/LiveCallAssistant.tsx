import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  Globe2, 
  Sparkles, 
  CheckCircle, 
  ArrowRight, 
  BookPlus, 
  ListPlus,
  Play, 
  Pause,
  RotateCcw,
  Languages,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { LiveSubtitleLine, IngestItem, ExtractedTodo, GemmaConfig } from '../types';
import { DEMO_ENGLISH_CALL_LINES } from '../data/mockPresets';
import { translateLocally, LocalTranslationResult } from '../lib/localExtraction';
import { translateWithOllama, translateWithOnDevice } from '../lib/localModel';
import { isNativeAndroid, OnDeviceModelStatus, VoxFlowNative } from '../lib/nativeBridge';

interface LiveCallAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCallSession: (newIngest: IngestItem) => void;
  gemmaConfig: GemmaConfig;
  onDeviceModel: OnDeviceModelStatus;
}

export const LiveCallAssistant: React.FC<LiveCallAssistantProps> = ({
  isOpen,
  onClose,
  onSaveCallSession,
  gemmaConfig,
  onDeviceModel,
}) => {
  const [callActive, setCallActive] = useState<boolean>(true);
  const [callSeconds, setCallSeconds] = useState<number>(0);
  const [callerName, setCallerName] = useState<string>('通话对象');
  const [callerPhone, setCallerPhone] = useState<string>('');
  
  // Real-time subtitles list
  const [subtitles, setSubtitles] = useState<LiveSubtitleLine[]>([]);
  const [isSimulationPlaying, setIsSimulationPlaying] = useState<boolean>(false);
  const [simStep, setSimStep] = useState<number>(0);
  
  // Live Mic input mode for real user speech testing
  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const [customEnglishSpeech, setCustomEnglishSpeech] = useState<string>('');
  const [isTranslatingCustom, setIsTranslatingCustom] = useState<boolean>(false);

  // Extracted actions collected during this call
  const [collectedActions, setCollectedActions] = useState<string[]>([]);

  const subtitleScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCallActive(true);
      setCallSeconds(0);
      setSubtitles([]);
      setIsSimulationPlaying(false);
      setSimStep(0);
      setCustomEnglishSpeech('');
      setCollectedActions([]);
      setCallerName('通话对象');
      setCallerPhone('');
      return;
    }

    setCallActive(false);
    setIsSimulationPlaying(false);
  }, [isOpen]);

  // Timer for active call
  useEffect(() => {
    let interval: any;
    if (isOpen && callActive) {
      interval = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callActive, isOpen]);

  // Simulation timeline for English Call demo
  useEffect(() => {
    if (!isOpen || !callActive || !isSimulationPlaying) return;

    if (simStep < DEMO_ENGLISH_CALL_LINES.length) {
      const timer = setTimeout(() => {
        const item = DEMO_ENGLISH_CALL_LINES[simStep];
        const newSubtitle: LiveSubtitleLine = {
          id: `sub-${Date.now()}-${simStep}`,
          speaker: item.speaker,
          englishText: item.englishText,
          chineseText: item.chineseText,
          timestamp: new Date().toLocaleTimeString().slice(0, 5),
          hasActionItem: item.hasActionItem,
          actionItem: item.actionItem,
        };

        setSubtitles((prev) => [...prev, newSubtitle]);
        if (item.actionItem && !collectedActions.includes(item.actionItem)) {
          setCollectedActions((prev) => [...prev, item.actionItem!]);
        }
        setSimStep((prev) => prev + 1);
      }, simStep === 0 ? 800 : 3500);

      return () => clearTimeout(timer);
    }
  }, [callActive, isOpen, isSimulationPlaying, simStep]);

  // Scroll to bottom when new subtitle appears
  useEffect(() => {
    if (subtitleScrollRef.current) {
      subtitleScrollRef.current.scrollTop = subtitleScrollRef.current.scrollHeight;
    }
  }, [subtitles]);

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const translateEnglish = async (text: string): Promise<LocalTranslationResult> => {
    // 1. On-device Gemma (LiteRT-LM) — offline-first.
    if (onDeviceModel.downloaded) {
      try {
        return await translateWithOnDevice(text);
      } catch (error) {
        console.warn('On-device translation failed, falling back:', error);
      }
    }

    // 2. Local Ollama.
    if (gemmaConfig.isConnected && gemmaConfig.mode !== 'cloud_gemini') {
      try {
        return await translateWithOllama({
          endpoint: gemmaConfig.localEndpoint,
          modelTag: gemmaConfig.modelTag,
          text,
        });
      } catch (error) {
        console.warn('Local translation failed, falling back to service/offline:', error);
      }
    }

    try {
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Translation result is invalid');

      return {
        original: data.original || text,
        translated: data.translated || '实时翻译解析完成',
        hasActionItem: Boolean(data.hasActionItem),
        actionItem: data.actionItem || '',
        sentiment: data.sentiment || 'neutral',
      };
    } catch {
      return translateLocally(text);
    }
  };

  const appendTranslatedSubtitle = (data: LocalTranslationResult, idPrefix: string) => {
    setSubtitles((previous) => [
      ...previous,
      {
        id: `${idPrefix}-${Date.now()}`,
        speaker: 'Caller',
        englishText: data.original,
        chineseText: data.translated,
        timestamp: new Date().toLocaleTimeString().slice(0, 5),
        hasActionItem: data.hasActionItem,
        actionItem: data.actionItem,
      },
    ]);

    if (data.actionItem) {
      setCollectedActions((previous) =>
        previous.includes(data.actionItem) ? previous : [...previous, data.actionItem]
      );
    }
  };

  // Handle custom English test translation
  const handleTranslateCustom = async () => {
    if (!customEnglishSpeech.trim()) return;
    setIsTranslatingCustom(true);
    try {
      const data = await translateEnglish(customEnglishSpeech);
      appendTranslatedSubtitle(data, 'custom');
      setCustomEnglishSpeech('');
    } finally {
      setIsTranslatingCustom(false);
    }
  };

  // Toggle Web Speech API for real mic input in English
  const toggleMicListening = () => {
    if (isNativeAndroid) {
      if (isMicListening) return;

      setIsMicListening(true);
      void VoxFlowNative.startSpeechRecognition({ language: 'en-US' })
        .then(async (result) => {
          if (!result.text?.trim()) return;
          const data = await translateEnglish(result.text);
          appendTranslatedSubtitle(data, 'native-mic');
          setCustomEnglishSpeech(result.text);
        })
        .catch(() => {
          alert('系统语音识别未完成，请确认已授权麦克风并安装系统语音服务。');
        })
        .finally(() => setIsMicListening(false));
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('当前浏览器环境暂未内置 Web Speech API，可直接在下方输入框键入英语模拟通话说话。');
      return;
    }

    if (!isMicListening) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsMicListening(true);
        recognition.onresult = async (event: any) => {
          const speechResult = event.results[0][0].transcript;
          setIsMicListening(false);
          setCustomEnglishSpeech(speechResult);
          
          // auto translate
          const data = await translateEnglish(speechResult);
          appendTranslatedSubtitle(data, 'mic');
        };
        recognition.onerror = () => setIsMicListening(false);
        recognition.onend = () => setIsMicListening(false);
        recognition.start();
      } catch (err) {
        setIsMicListening(false);
      }
    } else {
      setIsMicListening(false);
    }
  };

  // Save the real text captured during this session without fabricating call content.
  const handleEndCallAndArchive = () => {
    setCallActive(false);
    const sessionTimestamp = Date.now();
    const sessionId = `call-session-${sessionTimestamp}`;

    const fullTranscript = subtitles
      .map((s) => `[${s.timestamp}] ${s.speaker === 'Caller' ? callerName : '我'}: (EN) ${s.englishText}\n      [中文同步] ${s.chineseText}`)
      .join('\n\n');
    const savedTranscript =
      fullTranscript || '本次通话没有产生可识别的文本记录，请手动补充通话内容。';

    const newTodos: ExtractedTodo[] = collectedActions.map((act, idx) => ({
      id: `call-act-${sessionTimestamp}-${idx}`,
      sourceId: sessionId,
      title: act,
      dueDate: '待确认',
      priority: 'medium',
      completed: false,
      channel: 'phone',
      sender: callerName,
      senderPhone: callerPhone || undefined,
      sourcePackage: 'com.google.android.dialer',
      tags: ['英语通话', '实时识别', '待确认时间'],
      createdAt: '刚刚',
    }));

    const dateStr = new Date().toISOString().split('T')[0];
    const translatedLines = subtitles
      .map((subtitle) => subtitle.chineseText)
      .filter(Boolean);
    const keyTakeaways =
      translatedLines.length > 0
        ? translatedLines.slice(-3)
        : ['本次会话尚未识别到文字内容，可在通话记录中手动补充。'];
    const summary =
      translatedLines.length > 0
        ? `${translatedLines.slice(-2).join('；')}${translatedLines.length > 2 ? '。' : ''}`
        : '已保存通话会话，暂无可整理的语音文本。';
    const noteTitle = `英语通话记录：${callerName} (${dateStr})`;
    const newSessionItem: IngestItem = {
      id: sessionId,
      channel: 'phone',
      sender: callerName,
      senderPhone: callerPhone || undefined,
      timestamp: '刚刚',
      language: 'en',
      isEnglishCall: true,
      audioDuration: formatTime(callSeconds),
      status: 'processed',
      summary,
      todosCount: newTodos.length,
      rawContent: savedTranscript,
      extractedTodos: newTodos,
      knowledgeNote: {
        id: `kn-call-${sessionTimestamp}`,
        sourceId: sessionId,
        title: noteTitle,
        category: '通话记录 / 实时语音识别',
        channel: 'phone',
        sender: callerName,
        date: dateStr,
        keyTakeaways,
        tags: ['#通话记录', '#实时翻译', '#待办/电话'],
        rawSnippet: `${savedTranscript.slice(0, 160)}...`,
        obsidianMarkdown: `---
title: "${noteTitle}"
date: ${dateStr}
source: "phone_speech_capture"
caller: "${callerName}"
phone: "${callerPhone}"
language: "English to Chinese"
model_pipeline: "Android Speech Recognition + Local Rule Engine"
status: "processed"
tags:
  - "#通话记录"
  - "#实时翻译"
  - "#待办/电话"
---

# 通话记录：[[联系人/${callerName}]]

> **通话对象**: ${callerName} (${callerPhone || '未填写号码'})  
> **通话时长**: ${formatTime(callSeconds)}  
> **识别来源**: 系统语音识别与端侧文本翻译  

## 会话要点
${keyTakeaways.map((item) => `- ${item}`).join('\n')}

## 自动识别待办
${newTodos.length > 0 ? newTodos.map((t) => `- [ ] **${t.title}**`).join('\n') : '- 无明确行动项'}

## 双语识别文本
\`\`\`text
${savedTranscript}
\`\`\`
`,
      },
    };

    onSaveCallSession(newSessionItem);
    onClose();
  };

  const handleToggleSimulation = () => {
    if (isSimulationPlaying) {
      setIsSimulationPlaying(false);
      return;
    }

    if (subtitles.length === 0) {
      setCallerName('Sarah Jenkins (London Logistics)');
      setCallerPhone('+44 20 7946 0912');
      setSimStep(0);
      setCollectedActions([]);
    }
    setIsSimulationPlaying(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Top Floating In-Call Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Phone className="w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">{callerName}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {callActive ? '语音记录中 · 实时双语' : '会话已结束'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                <span>{callerPhone}</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">{formatTime(callSeconds)}</span>
                <span>•</span>
                <span className="text-indigo-400 inline-flex items-center gap-1">
                  <Languages className="w-3 h-3" />
                  EN ➔ 中文实时直译
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSimulation}
              className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 px-2.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
              title="载入或暂停英文对话演示流"
            >
              {isSimulationPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span className="hidden sm:inline">{isSimulationPlaying ? '暂停演示' : '载入演示'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900 px-4 sm:px-5 py-2.5 border-b border-slate-800">
          <input
            type="text"
            value={callerName}
            onChange={(event) => setCallerName(event.target.value)}
            placeholder="通话对象姓名"
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="tel"
            value={callerPhone}
            onChange={(event) => setCallerPhone(event.target.value)}
            placeholder="电话号码（可选）"
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Audio Waveform Simulation Bar */}
        <div className="bg-slate-950/60 px-5 py-2 border-b border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>实时音频流监测:</span>
            {/* animated wave bars */}
            <div className="flex items-center gap-0.5 h-4">
              {[40, 70, 95, 60, 30, 85, 100, 50, 75, 45, 90, 65, 35].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-gradient-to-t from-indigo-500 to-emerald-400 rounded-full animate-pulse"
                  style={{
                    height: callActive && isSimulationPlaying ? `${h}%` : '20%',
                    animationDuration: `${0.4 + (i % 5) * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1 text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              <Zap className="w-3 h-3 text-indigo-400" />
              实时语义动作提取中
            </span>
          </div>
        </div>

        {/* Subtitle Display Canvas (Scrollable) */}
        <div 
          ref={subtitleScrollRef}
          className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 bg-slate-950/30"
          style={{ minHeight: '260px' }}
        >
          {subtitles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <Globe2 className="w-8 h-8 text-indigo-400/60 animate-bounce" />
              <p className="text-sm font-medium text-slate-300">点击麦克风开始识别，或载入演示流</p>
              <p className="text-xs text-slate-500 max-w-md">
                系统语音识别会呈现英文原文与中文翻译，并高亮可执行的行动项。普通安卓应用无法直接读取通话双方的内部音频。
              </p>
            </div>
          ) : (
            subtitles.map((sub) => (
              <div
                key={sub.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  sub.speaker === 'Caller'
                    ? 'bg-slate-900/90 border-slate-800 ml-0 mr-6'
                    : 'bg-indigo-950/40 border-indigo-500/30 ml-6 mr-0'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-300">
                      {sub.speaker === 'Caller' ? callerName : '我'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{sub.timestamp}</span>
                  </div>
                  {sub.hasActionItem && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                      <Sparkles className="w-2.5 h-2.5" />
                      待办项已识别
                    </span>
                  )}
                </div>

                {/* English original */}
                <p className="text-xs sm:text-sm text-slate-300 font-sans tracking-wide">
                  {sub.englishText}
                </p>

                {/* Chinese translation line */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-start gap-1.5 text-xs sm:text-sm font-medium text-emerald-300">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-950/60 px-1 py-0.5 rounded mt-0.5">
                    中文
                  </span>
                  <span>{sub.chineseText}</span>
                </div>

                {/* Action item card inside subtitle if detected */}
                {sub.hasActionItem && sub.actionItem && (
                  <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-200">
                      <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{sub.actionItem}</span>
                    </div>
                    <span className="text-[10px] text-amber-400/80 font-mono">实时捕获</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Action Items Staging Bar */}
        {collectedActions.length > 0 && (
          <div className="bg-amber-950/20 border-t border-amber-500/20 px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto py-0.5 text-xs">
              <span className="text-amber-400 font-semibold whitespace-nowrap flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                已捕获行动 ({collectedActions.length}):
              </span>
              {collectedActions.map((act, i) => (
                <span
                  key={i}
                  className="bg-amber-500/15 text-amber-200 border border-amber-500/30 px-2 py-0.5 rounded-lg whitespace-nowrap text-[11px]"
                >
                  {act}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Live Mic / Custom English Testing Input */}
        <div className="bg-slate-900 p-3 sm:p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMicListening}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isMicListening
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
              }`}
              title="使用麦克风说一段英文实时测试"
            >
              {isMicListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={customEnglishSpeech}
              onChange={(e) => setCustomEnglishSpeech(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTranslateCustom()}
              placeholder="或手动输入一句英文（如：Please wire the deposit by 5 PM）..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <button
              onClick={handleTranslateCustom}
              disabled={isTranslatingCustom || !customEnglishSpeech.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              {isTranslatingCustom ? '翻译中...' : '测试转译'}
            </button>
          </div>

          {/* Bottom Call Management Controls */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>语音识别由系统服务处理；文字记录仅保存在本机</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="call-end-archive-btn"
                onClick={handleEndCallAndArchive}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>挂断并提取待办 / 存入 Obsidian</span>
              </button>

              <button
                onClick={onClose}
                className="bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>直接退出</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
