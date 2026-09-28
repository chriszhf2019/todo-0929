import React, { useEffect, useState } from 'react';
import { Check, Phone, Plus, X } from 'lucide-react';
import { ExtractedTodo, IngestItem } from '../types';

interface CallReviewModalProps {
  item: IngestItem | null;
  onClose: () => void;
  onConfirm: (item: IngestItem, selectedTodos: ExtractedTodo[], summary: string) => void;
}

const buildDefaultTodo = (item: IngestItem): ExtractedTodo => ({
  id: `call-followup-${item.id}`,
  sourceId: item.id,
  title: `跟进与 ${item.sender || '联系人'} 的通话`,
  dueDate: '待定',
  priority: 'medium',
  completed: false,
  channel: 'phone',
      sender: item.sender,
      senderPhone: item.senderPhone,
      sourcePackage: item.sourcePackage || 'com.google.android.dialer',
      tags: ['电话', '待跟进'],
  createdAt: '刚刚',
});

export const CallReviewModal: React.FC<CallReviewModalProps> = ({
  item,
  onClose,
  onConfirm,
}) => {
  const [summary, setSummary] = useState('');
  const [candidates, setCandidates] = useState<ExtractedTodo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    if (!item) return;
    const initial = [buildDefaultTodo(item)];
    setCandidates(initial);
    setSelectedIds(new Set(initial.map((todo) => todo.id)));
    setSummary(
      `通话已结束：${item.sender || '未知联系人'} · ${item.timestamp}${item.audioDuration ? ` · 时长 ${item.audioDuration}` : ''}。`
    );
    setNewTitle('');
  }, [item]);

  const toggleTodo = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCandidate = () => {
    const title = newTitle.trim();
    if (!title || !item) return;
    const todo: ExtractedTodo = {
      id: `call-followup-manual-${Date.now()}`,
      sourceId: item.id,
      title,
      dueDate: '待定',
      priority: 'medium',
      completed: false,
      channel: 'phone',
      sender: item.sender,
      senderPhone: item.senderPhone,
      sourcePackage: item.sourcePackage || 'com.google.android.dialer',
      tags: ['电话', '手动补充'],
      createdAt: '刚刚',
    };
    setCandidates((previous) => [...previous, todo]);
    setSelectedIds((previous) => new Set(previous).add(todo.id));
    setNewTitle('');
  };

  const confirm = () => {
    if (!item) return;
    const selected = candidates.filter((todo) => selectedIds.has(todo.id));
    onConfirm(item, selected, summary.trim());
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60 p-5 space-y-4 max-h-[86vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="w-4 h-4 text-emerald-300 shrink-0" />
            <h2 className="text-base font-bold text-white truncate">通话结束摘要</h2>
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
          <p className="text-sm font-semibold text-white">{item.sender || '未知联系人'}</p>
          <p className="text-xs text-slate-400">
            {item.timestamp}
            {item.audioDuration ? ` · 时长 ${item.audioDuration}` : ''}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-400">通话摘要</p>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
            placeholder="补充通话中需要跟进的内容；普通电话无法自动获取双方通话音频。"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400">选择要加入待办的事项</p>
          <div className="space-y-1.5">
            {candidates.map((todo) => (
              <label
                key={todo.id}
                className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 cursor-pointer"
              >
                <button
                  type="button"
                  onClick={() => toggleTodo(todo.id)}
                  className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                    selectedIds.has(todo.id)
                      ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                      : 'border-slate-600 text-transparent'
                  }`}
                  aria-label={selectedIds.has(todo.id) ? '取消选择' : '选择'}
                >
                  <Check className="w-3 h-3" />
                </button>
                <span>{todo.title}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addCandidate();
              }}
              className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              placeholder="添加一条待办"
            />
            <button
              onClick={addCandidate}
              className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              添加
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            跳过
          </button>
          <button
            onClick={confirm}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            加入待办
          </button>
        </div>
      </div>
    </div>
  );
};
