import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  FileText, 
  Copy, 
  Download, 
  ExternalLink, 
  Check, 
  Share2, 
  Tag, 
  Sparkles, 
  FolderSync, 
  Layers, 
  ChevronRight,
  Code2,
  Eye
} from 'lucide-react';
import { KnowledgeNote, ObsidianConfig } from '../types';

interface KnowledgeBaseProps {
  notes: KnowledgeNote[];
  obsidianConfig: ObsidianConfig;
  selectedNoteId?: string | null;
  onSelectNote: (noteId: string) => void;
  onOpenObsidianDeepLink: (note: KnowledgeNote) => void;
  onDownloadMarkdownFile: (note: KnowledgeNote) => void;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  notes,
  obsidianConfig,
  selectedNoteId,
  onSelectNote,
  onOpenObsidianDeepLink,
  onDownloadMarkdownFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFormat, setViewFormat] = useState<'rendered' | 'markdown'>('rendered');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q) ||
      n.keyTakeaways.some((t) => t.toLowerCase().includes(q)) ||
      n.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const activeNote =
    notes.find((note) => note.id === selectedNoteId) || filteredNotes[0] || notes[0];

  const handleCopyMarkdown = (note: KnowledgeNote) => {
    navigator.clipboard.writeText(note.obsidianMarkdown);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Knowledge Base Header */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>知识库与 Obsidian 沉淀中枢</span>
              <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                {notes.length} 篇结构化笔记
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            碎语归档，沉淀为标准 Obsidian 笔记。支持 YAML Frontmatter、双链语法 <code className="text-purple-300 bg-slate-900 px-1 py-0.5 rounded font-mono">[[联系人/标签]]</code> 与深链跳转
          </p>
        </div>

        {/* Vault Status Indicator */}
        <div className="flex items-center gap-2 text-xs bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <FolderSync className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="text-left font-mono">
            <span className="text-slate-400 text-[11px] block">目标 Obsidian Vault:</span>
            <span className="text-purple-300 font-bold">{obsidianConfig.vaultName || 'MyLifeVault'}</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Notes List & Note Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Notes Catalog List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索知识库标题、要点或 #标签..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Cards List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredNotes.map((note) => {
              const isSelected = activeNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-purple-950/40 border-purple-500/60 shadow-md ring-1 ring-purple-500/30'
                      : 'bg-slate-850 hover:bg-slate-800/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
                      {note.category}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{note.date}</span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-semibold text-white line-clamp-2 mb-1.5 leading-snug">
                    {note.title}
                  </h4>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {note.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredNotes.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                无匹配知识库笔记
              </div>
            )}
          </div>
        </div>

        {/* Right: Detailed Note Viewer & Obsidian Export Actions (8 cols) */}
        <div className="lg:col-span-8 bg-slate-850 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col min-h-[560px]">
          {activeNote ? (
            <div className="space-y-4 flex-1 flex flex-col">
              
              {/* Header Info & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-purple-400 block mb-1">
                    {activeNote.category} • 来自 {activeNote.sender}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {activeNote.title}
                  </h3>
                </div>

                {/* View Mode Toggle: Rendered vs Raw Markdown */}
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    onClick={() => setViewFormat('rendered')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      viewFormat === 'rendered'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>排版预览</span>
                  </button>
                  <button
                    onClick={() => setViewFormat('markdown')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      viewFormat === 'markdown'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Obsidian 源码</span>
                  </button>
                </div>
              </div>

              {/* Note Content */}
              {viewFormat === 'rendered' ? (
                <div className="flex-1 space-y-4 text-xs sm:text-sm text-slate-200">
                  {/* Key Takeaways block */}
                  <div className="bg-slate-900/90 rounded-xl p-4 border border-purple-500/20 space-y-2">
                    <h5 className="font-bold text-purple-300 flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      核心要点 (Key Insights):
                    </h5>
                    <ul className="space-y-1.5 pl-4 list-disc text-slate-300 text-xs sm:text-sm leading-relaxed">
                      {activeNote.keyTakeaways.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Wikilinks & Tags Showcase */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-400 font-medium">双向链接推荐:</span>
                    <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded font-mono">
                      [[联系人/{activeNote.sender}]]
                    </span>
                    <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">
                      [[归档/{activeNote.category.split('/')[0].trim()}]]
                    </span>
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                      [[{activeNote.date}]]
                    </span>
                  </div>

                  {/* Excerpt */}
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {activeNote.rawSnippet}
                  </div>
                </div>
              ) : (
                /* Raw Markdown with Frontmatter */
                <div className="flex-1">
                  <div className="h-full bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap overflow-y-auto max-h-[420px] leading-relaxed">
                    {activeNote.obsidianMarkdown}
                  </div>
                </div>
              )}

              {/* Obsidian Integration Actions Toolbar */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyMarkdown(activeNote)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === activeNote.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">已复制源码</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>复制 Markdown</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onDownloadMarkdownFile(activeNote)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="下载为 .md 文件放入 Obsidian Vault 文件夹"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载 .md 笔记</span>
                  </button>
                </div>

                {/* Direct Obsidian Deep Link */}
                <button
                  onClick={() => onOpenObsidianDeepLink(activeNote)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs px-4 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="调用系统 obsidian://new 协议直接在 Obsidian 桌面/安卓客户端创建该笔记"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>直接在 Obsidian 中打开</span>
                </button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <BookOpen className="w-10 h-10 text-slate-600" />
              <p className="text-sm">请选择左侧笔记以查看或导出</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
