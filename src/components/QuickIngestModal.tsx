import React, { useState } from 'react';
import { 
  Phone, 
  MessageSquare, 
  Send, 
  Sparkles, 
  X, 
  Clock, 
  User, 
  FileText,
  Volume2
} from 'lucide-react';
import { ChannelType, IngestItem } from '../types';

interface QuickIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndProcess: (newItem: IngestItem) => void;
}

export const QuickIngestModal: React.FC<QuickIngestModalProps> = ({
  isOpen,
  onClose,
  onSaveAndProcess,
}) => {
  const [channel, setChannel] = useState<ChannelType>('phone');
  const [sender, setSender] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [content, setContent] = useState('');
  const [isEnglishCall, setIsEnglishCall] = useState(false);
  const [duration, setDuration] = useState('02:15');

  if (!isOpen) return null;

  const handleApplyPreset = (type: ChannelType) => {
    setChannel(type);
    if (type === 'phone') {
      setSender('李总 (华东工业集团)');
      setSenderPhone('+86 138-0012-3456');
      setContent(
        '李总：小赵，关于下周一在杭州举行的智能装备峰会，有两件事紧急交代：\n1. 请在明天下班前把我们联合展台的设计效果图与预算表敲定发我；\n2. 预订周日晚上的高铁票与会场周边两间商务大床房。\n另外帮我向组委会确认一下周一上午李总演讲的第 3 个顺位是否确定。'
      );
      setIsEnglishCall(false);
      setDuration('03:40');
    } else if (type === 'sms') {
      setSender('【顺丰速运】 / 【招商银行】');
      setSenderPhone('95338');
      setContent(
        '【顺丰速运】您的重要海外文件快件已到达北京朝阳集散中心，派送码为 8291，预计今日 17:30 送达，请务必本人携带身份证原件签收并核验报关单据。\n【招商银行】您的账户收到转账汇款人民币 45,000.00 元，附言：技术开发首期款。'
      );
      setIsEnglishCall(false);
    } else if (type === 'wechat') {
      setSender('「AI应用与商业化创新」微信交流群');
      setContent(
        '【微信群消息】\n[张架构师 14:20] @所有人 针对记言 Todo 的 Obsidian 本地同步模块，大家务必在周五发布前完成以下 2 点：\n- 检查 Windows/macOS/Android 三端对 obsidian:// 深度链接协议唤起的兼容性；\n- 确保本地 Gemma 4 针对 200 字以上长通话摘要生成的截断保护；\n收到请在群里打 1 确认！'
      );
      setIsEnglishCall(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const newItem: IngestItem = {
      id: `ingest-${Date.now()}`,
      channel,
      sender: sender.trim() || (channel === 'phone' ? '电话来电' : channel === 'sms' ? '短信发件人' : '微信联系人'),
      senderPhone: senderPhone.trim() || undefined,
      timestamp: '刚刚',
      rawContent: content.trim(),
      language: isEnglishCall ? 'en' : 'zh',
      isEnglishCall,
      audioDuration: channel === 'phone' ? duration : undefined,
      status: 'raw',
    };

    onSaveAndProcess(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">录入信息流（电话/短信/微信）</h3>
              <p className="text-xs text-slate-400">录入后使用本地规则或已连接的模型提取待办与知识笔记</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-[11px] text-slate-400 font-medium shrink-0">快捷填充示例:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset('phone')}
            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            📞 客户电话交代
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('sms')}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            💬 重要短信通知
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('wechat')}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            🟢 微信群需求决议
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Channel selector */}
          <div>
            <label className="text-xs text-slate-300 font-medium mb-1 block">选择信息来源渠道</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel('phone')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  channel === 'phone'
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300 ring-1 ring-blue-500/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>电话录音/转写</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  channel === 'sms'
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300 ring-1 ring-amber-500/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>短信通知</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('wechat')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  channel === 'wechat'
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>微信记录</span>
              </button>
            </div>
          </div>

          {/* Sender & Extra info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300 font-medium mb-1 block">发件人 / 通话对象</label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="例如: 张经理 / 客户群 / 招商银行"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {channel === 'phone' ? (
              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">通话时长</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="例如: 03:40"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-300 font-medium mb-1 block">联系号码 / 发送号 (可选)</label>
                <input
                  type="text"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="例如: 1069xxxx / 95555"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Raw content text area */}
          <div>
            <label className="text-xs text-slate-300 font-medium mb-1 flex items-center justify-between">
              <span>原始对话 / 语音转文字 / 消息全文</span>
              {channel === 'phone' && (
                <label className="inline-flex items-center gap-1.5 text-xs text-teal-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnglishCall}
                    onChange={(e) => setIsEnglishCall(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-0"
                  />
                  <span>包含英语通话内容</span>
                </label>
              )}
            </label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此粘贴通话录音转写文本、短信内容或微信聊天记录..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg"
            >
              取消
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>保存并立即提取</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
