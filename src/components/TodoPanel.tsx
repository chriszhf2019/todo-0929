import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  Tag, 
  Phone, 
  MessageSquare, 
  Send, 
  Plus, 
  Filter, 
  ExternalLink, 
  Sparkles,
  Download,
  CheckCheck,
  Trash2,
  Pencil,
  Bell,
  Rocket,
  X
} from 'lucide-react';
import { ExtractedTodo, ChannelType, PriorityType } from '../types';

interface TodoPanelProps {
  todos: ExtractedTodo[];
  onToggleTodo: (id: string) => void;
  onAddTodo: (todo: Partial<ExtractedTodo>) => void;
  onUpdateTodo: (todo: ExtractedTodo) => void;
  onDeleteTodo: (id: string) => void;
  onClearCompleted: () => void;
  onExportTodosToDailyNote: () => void;
  onViewSource: (sourceId: string) => void;
  onExecuteTodo: (todo: ExtractedTodo) => void;
}

export const TodoPanel: React.FC<TodoPanelProps> = ({
  todos,
  onToggleTodo,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
  onClearCompleted,
  onExportTodosToDailyNote,
  onViewSource,
  onExecuteTodo,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending');
  const [filterPriority, setFilterPriority] = useState<'all' | PriorityType>('all');
  const [filterChannel, setFilterChannel] = useState<'all' | ChannelType>('all');
  
  // Quick add form state
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<PriorityType>('medium');
  const [newChannel, setNewChannel] = useState<ChannelType>('phone');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReminderAt, setNewReminderAt] = useState('');
  const [editingTodo, setEditingTodo] = useState<ExtractedTodo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<PriorityType>('medium');
  const [editReminderAt, setEditReminderAt] = useState('');

  const toLocalDateTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
  };

  const filteredTodos = todos.filter((todo) => {
    if (filterStatus === 'pending' && todo.completed) return false;
    if (filterStatus === 'completed' && !todo.completed) return false;
    if (filterPriority !== 'all' && todo.priority !== filterPriority) return false;
    if (filterChannel !== 'all' && todo.channel !== filterChannel) return false;
    return true;
  });

  const pendingCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddTodo({
      id: `manual-todo-${Date.now()}`,
      sourceId: 'manual',
      title: newTitle.trim(),
      dueDate: newDueDate || '今日待办',
      priority: newPriority,
      completed: false,
      channel: newChannel,
      sender: '手动快捷添加',
      tags: ['手动备忘', '记言Todo'],
      createdAt: '刚刚',
      reminderAt: newReminderAt ? new Date(newReminderAt).toISOString() : undefined,
    });

    setNewTitle('');
    setNewDueDate('');
    setNewReminderAt('');
    setShowAddForm(false);
  };

  const handleStartEdit = (todo: ExtractedTodo) => {
    setEditingTodo(todo);
    setEditTitle(todo.title);
    setEditDueDate(todo.dueDate);
    setEditPriority(todo.priority);
    setEditReminderAt(toLocalDateTime(todo.reminderAt));
  };

  const handleUpdateTodo = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTodo || !editTitle.trim()) return;

    onUpdateTodo({
      ...editingTodo,
      title: editTitle.trim(),
      dueDate: editDueDate.trim() || '待确认',
      priority: editPriority,
      reminderAt: editReminderAt ? new Date(editReminderAt).toISOString() : undefined,
    });
    setEditingTodo(null);
  };

  const getChannelIcon = (c: ChannelType) => {
    switch (c) {
      case 'phone':
        return <Phone className="w-3 h-3 text-blue-400" />;
      case 'sms':
        return <MessageSquare className="w-3 h-3 text-amber-400" />;
      case 'wechat':
        return <Send className="w-3 h-3 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Stats */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white">
              智能待办看板
            </h2>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
              待处理 {pendingCount} 项
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            从授权通知、通话记录和手动录入中提取关键执行项，并自动推断建议处理时间
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建待办</span>
          </button>

          <button
            onClick={onExportTodosToDailyNote}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            title="一键将待办列表汇总导出至 Obsidian 今日日记"
          >
            <Download className="w-3.5 h-3.5" />
            <span>汇总至 Obsidian 日记</span>
          </button>
        </div>
      </div>

      {/* Manual Quick Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTodo}
          className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in"
        >
          <div className="text-xs font-semibold text-indigo-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>手动录入待办事项</span>
          </div>
          <input
            type="text"
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="需要完成的行动项（例如：下午 4 点给客户回电话确认合同）..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">预计截止时间</label>
              <input
                type="text"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                placeholder="例如: 明天 18:00 / 本周五"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">优先级</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as PriorityType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="high">🔥 高优先级 (紧要)</option>
                <option value="medium">⚡ 中优先级 (常规)</option>
                <option value="low">🌱 低优先级 (备忘)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">归属渠道标记</label>
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value as ChannelType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="phone">📞 电话相关</option>
                <option value="sms">💬 短信相关</option>
                <option value="wechat">🟢 微信相关</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Bell className="w-3 h-3" />
              <span>到期提醒（可选）</span>
            </label>
            <input
              type="datetime-local"
              value={newReminderAt}
              onChange={(event) => setNewReminderAt(event.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded-lg"
            >
              取消
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
            >
              保存待办
            </button>
          </div>
        </form>
      )}

      {/* Edit Todo Form */}
      {editingTodo && (
        <form
          onSubmit={handleUpdateTodo}
          className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-3 animate-in"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1">
              <Pencil className="w-3.5 h-3.5" />
              <span>编辑待办事项</span>
            </div>
            <button
              type="button"
              onClick={() => setEditingTodo(null)}
              className="text-slate-500 hover:text-white p-1 rounded-lg"
              aria-label="关闭编辑"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            required
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">截止时间</label>
              <input
                type="text"
                value={editDueDate}
                onChange={(event) => setEditDueDate(event.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">优先级</label>
              <select
                value={editPriority}
                onChange={(event) => setEditPriority(event.target.value as PriorityType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="high">高优先级</option>
                <option value="medium">中优先级</option>
                <option value="low">低优先级</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Bell className="w-3 h-3" />
              <span>到期提醒（清空则取消提醒）</span>
            </label>
            <input
              type="datetime-local"
              value={editReminderAt}
              onChange={(event) => setEditReminderAt(event.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingTodo(null)}
              className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded-lg"
            >
              取消
            </button>
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
            >
              保存修改
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            全部 ({todos.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filterStatus === 'pending'
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            未完成 ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filterStatus === 'completed'
                ? 'bg-slate-800 text-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            已完成 ({completedCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none"
          >
            <option value="all">所有优先级</option>
            <option value="high">仅高优 (High)</option>
            <option value="medium">仅中优 (Med)</option>
            <option value="low">仅低优 (Low)</option>
          </select>

          {/* Channel filter */}
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none"
          >
            <option value="all">所有渠道来源</option>
            <option value="phone">仅电话</option>
            <option value="sms">仅短信</option>
            <option value="wechat">仅微信</option>
          </select>

          <button
            type="button"
            onClick={onClearCompleted}
            disabled={completedCount === 0}
            className="text-xs text-slate-300 hover:text-rose-300 disabled:text-slate-600 bg-slate-950 hover:bg-rose-500/10 disabled:bg-slate-950 border border-slate-800 hover:border-rose-500/30 disabled:border-slate-800 rounded-lg px-2.5 py-1 transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
            title="清理全部已完成待办"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">清理已完成</span>
          </button>
        </div>
      </div>

      {/* Todo Item Cards */}
      <div className="space-y-2.5">
        {filteredTodos.map((todo) => {
          return (
            <div
              key={todo.id}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all flex items-start justify-between gap-3 group ${
                todo.completed
                  ? 'bg-slate-900/50 border-slate-850 opacity-60'
                  : 'bg-slate-850 hover:bg-slate-800 border-slate-800 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Checkbox */}
                <button
                  onClick={() => onToggleTodo(todo.id)}
                  className="mt-0.5 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer shrink-0"
                  aria-label={`${todo.completed ? '标记为未完成' : '标记为已完成'}：${todo.title}`}
                  aria-pressed={todo.completed}
                >
                  {todo.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-500 group-hover:text-indigo-400" />
                  )}
                </button>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium ${
                        todo.completed ? 'line-through text-slate-500' : 'text-white'
                      }`}
                    >
                      {todo.title}
                    </span>

                    {/* Priority badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        todo.priority === 'high'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : todo.priority === 'medium'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {todo.priority === 'high' ? '高优' : todo.priority === 'medium' ? '中优' : '低优'}
                    </span>
                  </div>

                  {/* Sub details: dueDate, channel, sender */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-indigo-300 font-mono">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      {todo.dueDate}
                    </span>

                    {todo.reminderAt && (
                      <span className="flex items-center gap-1 text-amber-300">
                        <Bell className="w-3 h-3" />
                        <span>
                          {new Date(todo.reminderAt).toLocaleString('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    )}

                    <span className="flex items-center gap-1 text-slate-400">
                      {getChannelIcon(todo.channel)}
                      <span>{todo.sender || '原始消息'}</span>
                    </span>

                    {todo.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Source traceback action */}
              <div className="shrink-0 flex items-center gap-1.5">
                {todo.sourceId !== 'manual' && (
                  <button
                    onClick={() => onViewSource(todo.sourceId)}
                    className="text-[11px] text-slate-400 hover:text-indigo-300 bg-slate-800/80 hover:bg-slate-750 px-2 py-1 rounded-lg border border-slate-700/60 transition-colors flex items-center gap-1 cursor-pointer"
                    title="跳转定位原始电话录音/微信文本"
                  >
                    <span>溯源记录</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                {!todo.completed && (
                  <button
                    onClick={() => onExecuteTodo(todo)}
                    className="text-slate-400 hover:text-purple-300 bg-slate-800/80 hover:bg-purple-500/10 p-1.5 rounded-lg border border-slate-700/60 hover:border-purple-500/30 transition-colors cursor-pointer"
                    title="按待办内容自动打开应用并执行"
                    aria-label={`执行待办：${todo.title}`}
                  >
                    <Rocket className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleStartEdit(todo)}
                  className="text-slate-500 hover:text-amber-300 bg-slate-800/80 hover:bg-amber-500/10 p-1.5 rounded-lg border border-slate-700/60 hover:border-amber-500/30 transition-colors cursor-pointer"
                  title="编辑待办与提醒"
                  aria-label={`编辑待办：${todo.title}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteTodo(todo.id)}
                  className="text-slate-500 hover:text-rose-300 bg-slate-800/80 hover:bg-rose-500/10 p-1.5 rounded-lg border border-slate-700/60 hover:border-rose-500/30 transition-colors cursor-pointer"
                  title="删除此项待办"
                  aria-label={`删除待办：${todo.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredTodos.length === 0 && (
          <div className="p-10 text-center bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 text-slate-500 space-y-2">
            <CheckCheck className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium">没有匹配的待办事项</p>
            <p className="text-xs">
              在上方添加或在信息流水中点击“AI 智能整理并提炼待办”
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
