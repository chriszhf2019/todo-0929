import React, { useEffect, useRef, useState } from 'react';
import { 
  Phone, 
  MessageSquare, 
  Send, 
  Sparkles, 
  CheckCircle, 
  Calendar, 
  Clock, 
  FileText, 
  Tag, 
  ArrowUpRight, 
  Filter, 
  RefreshCw, 
  ChevronRight,
  ExternalLink,
  BookOpen,
  Volume2,
  Play,
  Share2,
  Copy,
  Plus,
  ShieldCheck,
  Music2,
  Save
} from 'lucide-react';
import { IngestItem, ChannelType, ExtractedTodo } from '../types';

interface ChannelCaptureProps {
  items: IngestItem[];
  onTriggerAiProcess: (item: IngestItem) => Promise<void>;
  isProcessingId: string | null;
  onSelectTodoTab: () => void;
  onSelectKnowledgeTab: (noteId?: string) => void;
  onOpenQuickIngest: () => void;
  onExportToObsidian: (item: IngestItem) => void;
  focusedItemId?: string | null;
  onFocusHandled?: () => void;
  canSyncNative: boolean;
  isNativeSyncing: boolean;
  onSyncNativeData: () => Promise<void>;
  onImportCallRecording: () => Promise<void>;
  onUpdateIngestContent: (itemId: string, rawContent: string) => void;
}

export const ChannelCapture: React.FC<ChannelCaptureProps> = ({
  items,
  onTriggerAiProcess,
  isProcessingId,
  onSelectTodoTab,
  onSelectKnowledgeTab,
  onOpenQuickIngest,
  onExportToObsidian,
  focusedItemId,
  onFocusHandled,
  canSyncNative,
  isNativeSyncing,
  onSyncNativeData,
  onImportCallRecording,
  onUpdateIngestContent,
}) => {
  const [filterChannel, setFilterChannel] = useState<'all' | ChannelType>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const focusedItemRef = useRef<HTMLDivElement | null>(null);
  const [transcriptItemId, setTranscriptItemId] = useState<string | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState('');

  useEffect(() => {
    if (!focusedItemId) return;

    setFilterChannel('all');
    const frame = window.requestAnimationFrame(() => {
      focusedItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const timer = window.setTimeout(() => onFocusHandled?.(), 2600);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusedItemId]);

  const filteredItems = items.filter((item) => {
    if (filterChannel === 'all') return true;
    return item.channel === filterChannel;
  });

  const getChannelBadge = (channel: ChannelType) => {
    switch (channel) {
      case 'phone':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
            <Phone className="w-3 h-3" />
            电话通话
          </span>
        );
      case 'sms':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            <MessageSquare className="w-3 h-3" />
            短信通知
          </span>
        );
      case 'wechat':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <Send className="w-3 h-3" />
            微信记录
          </span>
        );
    }
  };

  const getEngineBadge = (engine?: IngestItem['extractionEngine']) => {
    switch (engine) {
      case 'on-device':
        return (
          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
            端侧模型
          </span>
        );
      case 'local-ollama':
        return (
          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
            本地模型
          </span>
        );
      case 'gemini':
        return (
          <span className="text-[10px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full shrink-0">
            Gemini 云端
          </span>
        );
      case 'local-rules':
        return (
          <span className="text-[10px] font-bold text-slate-300 bg-slate-700/50 border border-slate-600/40 px-2 py-0.5 rounded-full shrink-0">
            端侧规则
          </span>
        );
      default:
        return null;
    }
  };

  const copyObsidianMarkdown = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Channel Filter Tabs */}
      <div className="bg-slate-850 border border-slate-850 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>多端信息捕获流水线</span>
            <span className="text-xs font-mono font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
              共 {items.length} 条记录
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            同步系统通话记录与经授权的短信、微信通知，再使用本地规则或你配置的模型提取待办
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {canSyncNative && (
            <>
              <button
                onClick={() => void onSyncNativeData()}
                disabled={isNativeSyncing}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>{isNativeSyncing ? '同步中...' : '同步系统记录'}</span>
              </button>
              <button
                onClick={() => void onImportCallRecording()}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <Music2 className="w-3 h-3" />
                <span>导入通话录音</span>
              </button>
            </>
          )}
          <button
            onClick={() => setFilterChannel('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filterChannel === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            全部 ({items.length})
          </button>
          <button
            onClick={() => setFilterChannel('phone')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              filterChannel === 'phone'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-blue-300'
            }`}
          >
            <Phone className="w-3 h-3" />
            电话 ({items.filter((i) => i.channel === 'phone').length})
          </button>
          <button
            onClick={() => setFilterChannel('sms')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              filterChannel === 'sms'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            短信 ({items.filter((i) => i.channel === 'sms').length})
          </button>
          <button
            onClick={() => setFilterChannel('wechat')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              filterChannel === 'wechat'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <Send className="w-3 h-3" />
            微信 ({items.filter((i) => i.channel === 'wechat').length})
          </button>
        </div>
      </div>

      {/* Stream Cards */}
      <div className="space-y-4">
        {filteredItems.map((item) => {
          const isProcessing = isProcessingId === item.id;
          const hasProcessed = item.status === 'processed' && item.knowledgeNote;

          return (
            <div
              key={item.id}
              ref={focusedItemId === item.id ? focusedItemRef : undefined}
              data-ingest-id={item.id}
              className={`bg-slate-850 hover:bg-slate-800/90 border rounded-2xl p-4 sm:p-5 transition-all shadow-md group ${
                focusedItemId === item.id
                  ? 'border-indigo-400 ring-2 ring-indigo-500/30 shadow-indigo-950/50'
                  : 'border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  {getChannelBadge(item.channel)}
                  <span className="font-semibold text-white text-sm">
                    {item.sender}
                  </span>
                  {item.senderPhone && (
                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                      ({item.senderPhone})
                    </span>
                  )}
                  {item.isEnglishCall && (
                    <span className="text-[10px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-full">
                      英语双语翻译
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  {item.audioDuration && (
                    <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                      <Volume2 className="w-3 h-3 text-indigo-400" />
                      {item.audioDuration}
                    </span>
                  )}
                  <span>{item.timestamp}</span>
                </div>
              </div>

              {/* Raw Ingest Excerpt / Bubbles */}
              <div className="my-3">
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans font-normal max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {item.rawContent}
                </div>
              </div>

              {item.callRecordingUrl && (
                <div className="mb-3 rounded-xl border border-blue-500/25 bg-blue-500/5 p-3 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                    <Music2 className="w-3.5 h-3.5" />
                    <span>系统通话录音</span>
                  </div>
                  <audio
                    controls
                    preload="metadata"
                    src={item.callRecordingUrl}
                    className="w-full h-9"
                  />

                  {transcriptItemId === item.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={transcriptDraft}
                        onChange={(event) => setTranscriptDraft(event.target.value)}
                        placeholder="播放录音后在这里填写或粘贴转写文本..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setTranscriptItemId(null)}
                          className="text-xs text-slate-400 hover:text-white px-2.5 py-1"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => {
                            if (!transcriptDraft.trim()) return;
                            onUpdateIngestContent(item.id, transcriptDraft.trim());
                            setTranscriptItemId(null);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>保存并提取</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setTranscriptItemId(item.id);
                        setTranscriptDraft(
                          item.rawContent.startsWith('[系统通话录音]') ? '' : item.rawContent
                        );
                      }}
                      className="text-xs text-blue-300 hover:text-blue-200 font-medium"
                    >
                      补充或修改转写文本
                    </button>
                  )}
                </div>
              )}

              {/* AI Gemma 4 Extraction Results Section */}
              {hasProcessed ? (
                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      智能整理摘要:
                    </span>
                    <div className="flex items-center gap-2">
                      {getEngineBadge(item.extractionEngine)}
                      <span className="text-[11px] text-slate-400 font-mono">
                        待办 ({item.extractedTodos?.length || 0}) • 知识库已归档
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 font-medium">
                    {item.summary}
                  </p>

                  {/* Quick Preview of Extracted Todos */}
                  {item.extractedTodos && item.extractedTodos.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {item.extractedTodos.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                t.priority === 'high'
                                  ? 'bg-rose-500'
                                  : t.priority === 'medium'
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                            />
                            <span className="text-white truncate font-medium">{t.title}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                            📅 {t.dueDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onSelectTodoTab}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>在待办清单中查看</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onSelectKnowledgeTab(item.knowledgeNote?.id)}
                        className="text-xs text-purple-400 hover:text-purple-300 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ml-3"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>查看知识库笔记</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyObsidianMarkdown(item.knowledgeNote!.obsidianMarkdown, item.id)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        title="复制适合 Obsidian 的 Markdown 源码"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedId === item.id ? '已复制 Markdown' : '复制 Obsidian 格式'}</span>
                      </button>

                      <button
                        onClick={() => onExportToObsidian(item)}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-lg text-xs font-medium shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                        title="导出到本地 Obsidian Vault"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>导出 Obsidian (.md)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-400">
                    未解析 • 包含潜在行动与商务信息
                  </div>

                  <button
                    onClick={() => onTriggerAiProcess(item)}
                    disabled={isProcessing}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs px-3.5 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>{isProcessing ? '智能整理中...' : '整理并提炼待办'}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 text-slate-500 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium">当前分类下暂无捕获信息</p>
            <p className="text-xs">
              点击右下角加号手动录入，或前往系统设置授权后同步真实记录
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
