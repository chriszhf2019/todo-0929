import React, { useState } from 'react';
import { 
  Activity,
  Sparkles, 
  Smartphone, 
  Monitor, 
  BookOpen, 
  Cpu, 
  PhoneCall, 
  Plus, 
  HelpCircle, 
  CheckCircle2, 
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { GemmaConfig, ObsidianConfig } from '../types';
import { APP_NAMING_PROPOSALS } from '../data/mockPresets';

interface HeaderProps {
  viewMode: 'mobile' | 'desktop';
  setViewMode: (mode: 'mobile' | 'desktop') => void;
  gemmaConfig: GemmaConfig;
  obsidianConfig: ObsidianConfig;
  onOpenSettings: (tab?: string) => void;
  onOpenQuickIngest: () => void;
  onStartLiveCall: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  gemmaConfig,
  obsidianConfig,
  onOpenSettings,
  onOpenQuickIngest,
  onStartLiveCall,
  activeTab,
  setActiveTab,
}) => {
  const [showNamingModal, setShowNamingModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Brand & Name Proposal Button */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600 p-[1px] shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[11px] flex items-center justify-center">
                <span className="text-xl">🎙️</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  记言 Todo
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    VoxFlow
                  </span>
                </h1>
                <button
                  id="header-naming-btn"
                  onClick={() => setShowNamingModal(true)}
                  className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/20 transition-all cursor-pointer"
                  title="查看应用起名与品牌方案"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>起个名字 / 品牌建议</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                系统通知与通话记录整理 | 英语语音翻译 | Obsidian 与本地模型
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (for Desktop mode) */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              id="nav-tab-capture"
              onClick={() => setActiveTab('capture')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'capture'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              📥 信息收集流水
            </button>
            <button
              id="nav-tab-todos"
              onClick={() => setActiveTab('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'todos'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              ✅ 提取待办 Todo
            </button>
            <button
              id="nav-tab-knowledge"
              onClick={() => setActiveTab('knowledge')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'knowledge'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              📚 沉淀知识库
            </button>
            <button
              id="nav-tab-monitor"
              onClick={() => setActiveTab('monitor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'monitor'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              应用监控
            </button>
            <button
              id="nav-tab-debug"
              onClick={() => setActiveTab('debug')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'debug'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              🛠️ Debug
            </button>
            <button
              id="nav-tab-obsidian"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'settings'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              系统 & Obsidian
            </button>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2">
            
            {/* Live Call Translation Trigger */}
            <button
              id="header-live-call-btn"
              onClick={onStartLiveCall}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-md shadow-emerald-900/30 transition-all cursor-pointer active:scale-95"
            >
              <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden xl:inline">英语通话实时翻译</span>
              <span className="xl:hidden">实时翻译</span>
            </button>

            {/* Quick Ingest Button */}
            <button
              id="header-quick-ingest-btn"
              onClick={onOpenQuickIngest}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95"
              title="手动录入通话、短信或微信"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">录入信息</span>
            </button>

            {/* Hardware/Engine Status Pill */}
            <button
              id="header-engine-pill"
              onClick={() => onOpenSettings('gemma')}
              className="hidden 2xl:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded-xl border border-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
              title="点击配置本地模型与系统接入"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono text-[11px]">
                {gemmaConfig.mode === 'local_gemma'
                  ? '本地模型在线'
                  : gemmaConfig.mode === 'hybrid'
                  ? '混合处理'
                  : '云端 Gemini'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  gemmaConfig.isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
            </button>

            {/* View Mode Toggle: Android Mobile Frame vs Desktop */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
              <button
                id="view-mode-mobile"
                onClick={() => setViewMode('mobile')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'mobile'
                    ? 'bg-slate-700 text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="切换到安卓真机交互视图"
              >
                <Smartphone className="w-4 h-4" />
              </button>
              <button
                id="view-mode-desktop"
                onClick={() => setViewMode('desktop')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'desktop'
                    ? 'bg-slate-700 text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="切换到宽屏全景视图"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Naming & Branding Proposal Modal */}
      {showNamingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>应用命名与品牌定位方案建议</span>
                </div>
                <h3 className="text-xl font-bold text-white">
                  给您的应用起个名字：从「沟通记录」到「高能待办」
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  根据您提出的功能特性（电话+短信+微信自动整理、待办提取、知识库归档、实时英语翻译、Obsidian 与 Gemma4 联动），精选了 4 个品牌化名称供您选择：
                </p>
              </div>
              <button
                onClick={() => setShowNamingModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {APP_NAMING_PROPOSALS.map((opt, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    idx === 0
                      ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-900/20 ring-1 ring-indigo-500/30'
                      : 'bg-slate-850 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-white">{opt.chineseName}</span>
                      <span className="text-xs font-mono font-semibold text-indigo-400">{opt.englishName}</span>
                    </div>
                    {idx === 0 && (
                      <span className="text-[10px] bg-indigo-500 text-white font-bold px-2 py-0.5 rounded-full">
                        首推主选
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-300/90 font-medium mb-2 italic">“{opt.tagline}”</p>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <p><span className="text-slate-400">风格心智:</span> {opt.vibe}</p>
                    <p><span className="text-slate-400">定位适用:</span> {opt.recommendedRole}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 text-xs text-slate-300 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">当前产品定名：</span>
                <span className="text-indigo-400 font-bold ml-1">记言 Todo · VoxFlow</span>
                <span className="text-slate-400 ml-2">（已预置在移动端与 Obsidian 导出模版中）</span>
              </div>
              <button
                onClick={() => setShowNamingModal(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
