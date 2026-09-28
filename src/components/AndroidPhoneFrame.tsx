import React, { useEffect, useState } from 'react';
import { 
  Activity,
  Wifi, 
  Battery, 
  Signal, 
  Phone, 
  CheckSquare, 
  BookOpen, 
  Settings, 
  Plus, 
  PhoneCall,
  Sparkles
} from 'lucide-react';

interface AndroidPhoneFrameProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onStartLiveCall: () => void;
  onOpenQuickIngest: () => void;
  pendingTodosCount: number;
  fullscreen?: boolean;
}

export const AndroidPhoneFrame: React.FC<AndroidPhoneFrameProps> = ({
  children,
  activeTab,
  setActiveTab,
  onStartLiveCall,
  onOpenQuickIngest,
  pendingTodosCount,
  fullscreen = false,
}) => {
  const [currentTime, setCurrentTime] = useState(() =>
    new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(
        new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date())
      );
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className={fullscreen ? 'w-full' : 'w-full flex justify-center py-4 px-2'}>
      {/* Smartphone Outer Chassis */}
      <div
        className={
          fullscreen
            ? 'w-full h-[100dvh] bg-slate-950 flex flex-col overflow-hidden relative'
            : 'w-full max-w-[420px] bg-slate-950 rounded-[44px] border-[8px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col overflow-hidden min-h-[820px] relative ring-1 ring-slate-700/50'
        }
      >
        
        {/* Dynamic Island / Camera Punch-hole & Status Bar */}
        <div
          className={`bg-slate-900/95 safe-top px-5 pb-2 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 select-none z-20 ${
            fullscreen ? 'sticky top-0 backdrop-blur-md' : ''
          }`}
        >
          <span className="font-semibold text-white font-mono text-[11px]">{currentTime}</span>
          
          {/* Camera Notch */}
          <div className={`bg-slate-950 rounded-full flex items-center justify-center border border-slate-800/80 ${
            fullscreen ? 'w-3 h-3' : 'w-20 h-4'
          }`}>
            <span className={`rounded-full bg-slate-800 ${fullscreen ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Quick App Floating In-Call Bar Shortcut */}
        <div className="bg-indigo-950/80 px-4 py-2 border-b border-indigo-500/20 flex items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="whitespace-nowrap">记言 Todo · 端侧运行中</span>
          </div>

          <button
            onClick={onStartLiveCall}
            className="text-[10px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <PhoneCall className="w-2.5 h-2.5" />
            <span>实时翻译</span>
          </button>
        </div>

        {/* Scrollable Mobile App Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 bg-slate-900/95 space-y-4 scrollbar-thin">
          <div className="w-full max-w-4xl mx-auto space-y-4">{children}</div>
        </div>

        {/* Android Floating Action Button (FAB) */}
        <button
          onClick={onOpenQuickIngest}
          className={`absolute right-5 z-30 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-xl shadow-indigo-900/60 flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
            fullscreen ? 'bottom-24' : 'bottom-20'
          }`}
          title="录入电话、短信或微信"
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* Android Native Style Bottom Navigation Bar */}
        <div
          className={`bg-slate-950/95 border-t border-slate-800/80 px-4 pt-2 flex items-center justify-around select-none ${
            fullscreen ? 'safe-bottom sticky bottom-0 z-20 backdrop-blur-md' : 'py-2 z-20'
          }`}
        >
          <button
            onClick={() => setActiveTab('capture')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'capture' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>信息流</span>
          </button>

          <button
            onClick={() => setActiveTab('todos')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors relative cursor-pointer ${
              activeTab === 'todos' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>待办</span>
            {pendingTodosCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingTodosCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'knowledge' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>知识库</span>
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'monitor' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>监控</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>系统设置</span>
          </button>
        </div>

        {/* Android Gesture Bar */}
        {!fullscreen && (
          <div className="bg-slate-950 pb-2 pt-1 flex justify-center">
            <div className="w-32 h-1 bg-slate-700/80 rounded-full" />
          </div>
        )}

      </div>
    </div>
  );
};
