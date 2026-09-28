import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Header } from './components/Header';
import { ChannelCapture } from './components/ChannelCapture';
import { TodoPanel } from './components/TodoPanel';
import { KnowledgeBase } from './components/KnowledgeBase';
import { GemmaObsidianSettings } from './components/GemmaObsidianSettings';
import { LiveCallAssistant } from './components/LiveCallAssistant';
import { QuickIngestModal } from './components/QuickIngestModal';
import { AndroidPhoneFrame } from './components/AndroidPhoneFrame';
import { AppUsageMonitor } from './components/AppUsageMonitor';
import { TodoExecuteModal } from './components/TodoExecuteModal';
import { CallReviewModal } from './components/CallReviewModal';
import DebugPanel from './components/DebugPanel';
import { ChannelType, IngestItem, ExtractedTodo, KnowledgeNote, GemmaConfig, ObsidianConfig } from './types';
import { INITIAL_INGEST_ITEMS } from './data/mockPresets';
import { Check } from 'lucide-react';
import { usePersistentState } from './hooks/usePersistentState';
import { useNativeSync } from './hooks/useNativeSync';
import { pingOllama, translateWithOnDevice } from './lib/localModel';
import { processIngestItem } from './lib/aiPipeline';
import { startQueueProcessor } from './lib/queueProcessor';
import { cancelTodoReminder, scheduleTodoReminder } from './lib/reminders';
import {
  getNativeCaptureStatus,
  getOnDeviceModelStatus,
  isNativeAndroid,
  NativeCaptureStatus,
  NativeCallLogRecord,
  NativeNotificationRecord,
  NativeVisualTextRecord,
  NativeAppUsageSession,
  OnDeviceModelStatus,
  VoxFlowNative,
} from './lib/nativeBridge';

const EMPTY_NATIVE_STATUS: NativeCaptureStatus = {
  isNativeAndroid: false,
  notificationAccess: false,
  accessibilityAccess: false,
  microphonePermission: false,
  callLogPermission: false,
  desktopPetEnabled: false,
};

const formatNativeTimestamp = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));

const VISUAL_UI_LABELS = new Set([
  '微信',
  'QQ',
  '聊天',
  '通讯录',
  '发现',
  '我',
  '搜索',
  '消息',
  '联系人',
  '动态',
  '设置',
  '返回',
  '更多',
  '发送',
]);

const channelFromPackage = (packageName: string): ChannelType => {
  const pkg = packageName.toLowerCase();
  if (pkg.includes('messaging') || pkg.includes('mms') || pkg.includes('sms')) return 'sms';
  if (pkg.includes('dialer') || pkg.includes('incallui')) return 'phone';
  return 'wechat';
};

const senderFromVisualText = (record: NativeVisualTextRecord) => {
  const lines = record.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const contact = lines.find(
    (line) => line.length >= 2 && line.length <= 16 && !VISUAL_UI_LABELS.has(line) && !/^\d+$/.test(line)
  );
  return contact || record.appName || '屏幕对话';
};

const formatCallDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
};

export default function App() {
  const [items, setItems] = usePersistentState<IngestItem[]>(
    'voxflow.ingestItems',
    []
  );
  const [activeTab, setActiveTab] = useState<string>('capture');
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>(() =>
    isNativeAndroid || window.innerWidth < 768 ? 'mobile' : 'desktop'
  );
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    window.matchMedia('(max-width: 767px)').matches
  );
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const stop = startQueueProcessor();
    return () => stop?.();
  }, []);

  // Modals
  const [showQuickIngest, setShowQuickIngest] = useState(false);
  const [showLiveCall, setShowLiveCall] = useState(false);
  const [executingTodo, setExecutingTodo] = useState<ExtractedTodo | null>(null);
  const [callReviewItem, setCallReviewItem] = useState<IngestItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Gemma 4 local model configuration
  const [gemmaConfig, setGemmaConfig] = usePersistentState<GemmaConfig>('voxflow.gemmaConfig', {
    mode: 'local_gemma',
    localEndpoint: 'http://localhost:11434',
    modelTag: 'gemma4:latest',
    zeroCloudPrivacy: true,
    quantization: '4-bit NPU (Mobile)',
    isConnected: false,
    lastPingStatus: '尚未测试本地模型连接',
  });

  // Obsidian configuration
  const [obsidianConfig, setObsidianConfig] = usePersistentState<ObsidianConfig>(
    'voxflow.obsidianConfig',
    {
      vaultName: 'MyLifeVault',
      notesFolder: 'Inbox/记言Todo/',
      dailyNotesFolder: 'DailyNotes/',
      autoWikilinks: true,
      deepLinkProtocol: true,
      defaultTags: ['#记言Todo', '#本地提取'],
    }
  );

  // On-device Gemma model status (MediaPipe LLM Inference)
  const [onDeviceModel, setOnDeviceModel] = useState<OnDeviceModelStatus>({
    state: 'not_downloaded',
    downloaded: false,
    modelPath: '',
    modelSizeBytes: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    errorMessage: '',
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsNarrowViewport(event.matches);
      if (event.matches) {
        setViewMode('mobile');
      }
    };

    setIsNarrowViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, []);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshOnDeviceModelStatus = async () => {
    if (!isNativeAndroid) return;
    try {
      setOnDeviceModel(await getOnDeviceModelStatus());
    } catch {
      // Keep previous status on transient errors.
    }
  };

  const handleDownloadOnDeviceModel = async (url: string) => {
    if (!isNativeAndroid) {
      showToast('端侧模型仅在实际安装的安卓应用中可用', 'info');
      return;
    }
    try {
      await VoxFlowNative.downloadOnDeviceModel({ url });
      showToast('已开始下载端侧模型');
      void refreshOnDeviceModelStatus();
    } catch {
      showToast('无法开始下载端侧模型', 'info');
    }
  };

  useEffect(() => {
    void refreshOnDeviceModelStatus();
  }, []);

  // Auto-detect a reachable local Ollama on startup so the real model path works
  // without the user having to press "test connection" first.
  useEffect(() => {
    if (gemmaConfig.mode === 'cloud_gemini') return;
    let cancelled = false;
    void pingOllama(gemmaConfig.localEndpoint)
      .then((models) => {
        if (cancelled) return;
        const configuredTag = gemmaConfig.modelTag.trim();
        const hasModel = Boolean(configuredTag) && models.some((name) => name === configuredTag);
        setGemmaConfig((prev) => ({
          ...prev,
          isConnected: hasModel,
          lastPingStatus: hasModel ? '已自动连接本地模型服务' : '已连接服务，但未找到配置的模型',
        }));
      })
      .catch(() => {
        // Silent: without a reachable local model we keep using the rule engine.
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount using the saved config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flattened active todos derived from items + standalone todos
  const [customTodos, setCustomTodos] = usePersistentState<ExtractedTodo[]>(
    'voxflow.customTodos',
    []
  );
  
  const allTodos = useMemo(() => {
    const fromItems: ExtractedTodo[] = [];
    items.forEach((item) => {
      if (item.extractedTodos) {
        fromItems.push(...item.extractedTodos);
      }
    });
    return [...customTodos, ...fromItems];
  }, [items, customTodos]);

  // Keep a native copy of pending todos so the accessibility overlay can show
  // contextual reminders even when the WebView is not in the foreground.
  useEffect(() => {
    if (!isNativeAndroid) return;
    const pending = allTodos.filter((todo) => !todo.completed);
    void VoxFlowNative.syncTodos({ todos: JSON.stringify(pending) }).catch(() => undefined);
  }, [allTodos]);

  // Flattened active knowledge notes derived from items
  const allKnowledgeNotes = useMemo(() => {
    const list: KnowledgeNote[] = [];
    items.forEach((item) => {
      if (item.knowledgeNote) {
        list.push(item.knowledgeNote);
      }
    });
    return list;
  }, [items]);

  // AI Processing pipeline for an ingest item
  const handleTriggerAiProcess = async (item: IngestItem) => {
    await processIngestItem(item, {
      setItems,
      setIsProcessingId,
      showToast,
      gemmaConfig,
      onDeviceModel,
    });
  };
  // Native sync handled via `useNativeSync` hook; see hook wiring below.

  // Toggle todo completion
  const handleToggleTodo = (todoId: string) => {
    const existingTodo = allTodos.find((todo) => todo.id === todoId);
    if (existingTodo && !existingTodo.completed) {
      void cancelTodoReminder(existingTodo);
    }

    // Check if in customTodos
    if (customTodos.some((t) => t.id === todoId)) {
      setCustomTodos((prev) =>
        prev.map((t) => (t.id === todoId ? { ...t, completed: !t.completed } : t))
      );
      return;
    }

    // Otherwise inside items
    setItems((prev) =>
      prev.map((item) => {
        if (!item.extractedTodos) return item;
        return {
          ...item,
          extractedTodos: item.extractedTodos.map((t) =>
            t.id === todoId ? { ...t, completed: !t.completed } : t
          ),
        };
      })
    );
  };

  // Add manual todo
  const handleAddTodo = (todo: Partial<ExtractedTodo>) => {
    const newTodo = todo as ExtractedTodo;
    setCustomTodos((prev) => [newTodo, ...prev]);
    showToast('已添加新待办事项');

    if (newTodo.reminderAt) {
      void scheduleTodoReminder(newTodo)
        .then((scheduledTodo) => {
          setCustomTodos((prev) =>
            prev.map((item) => (item.id === scheduledTodo.id ? scheduledTodo : item))
          );
          showToast('待办提醒已设置');
        })
        .catch(() => showToast('提醒保存失败，请检查通知权限', 'info'));
    }
  };

  const handleConfirmCallReview = (
    item: IngestItem,
    selectedTodos: ExtractedTodo[],
    summary: string
  ) => {
    setItems((previous) =>
      previous.map((current) =>
        current.id === item.id
          ? {
              ...current,
              status: 'processed',
              summary: summary || `与 ${item.sender || '联系人'} 的通话纪要`,
              todosCount: selectedTodos.length,
              extractedTodos: selectedTodos,
            }
          : current
      )
    );
    setCallReviewItem(null);
    if (selectedTodos.length > 0) {
      showToast(`已从通话摘要加入 ${selectedTodos.length} 项待办`);
    } else {
      showToast('已保存通话摘要', 'info');
    }
  };

  const handleUpdateTodo = (updatedTodo: ExtractedTodo) => {
    const previousTodo = allTodos.find((todo) => todo.id === updatedTodo.id);
    void cancelTodoReminder(previousTodo);

    if (customTodos.some((todo) => todo.id === updatedTodo.id)) {
      setCustomTodos((prev) =>
        prev.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo))
      );
    } else {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          extractedTodos: item.extractedTodos?.map((todo) =>
            todo.id === updatedTodo.id ? updatedTodo : todo
          ),
        }))
      );
    }

    if (updatedTodo.reminderAt && !updatedTodo.completed) {
      void scheduleTodoReminder(updatedTodo)
        .then((scheduledTodo) => {
          if (customTodos.some((todo) => todo.id === scheduledTodo.id)) {
            setCustomTodos((prev) =>
              prev.map((todo) => (todo.id === scheduledTodo.id ? scheduledTodo : todo))
            );
          } else {
            setItems((prev) =>
              prev.map((item) => ({
                ...item,
                extractedTodos: item.extractedTodos?.map((todo) =>
                  todo.id === scheduledTodo.id ? scheduledTodo : todo
                ),
              }))
            );
          }
          showToast('待办与提醒已更新');
        })
        .catch(() => showToast('待办已更新，但提醒设置失败', 'info'));
    } else {
      showToast('待办已更新');
    }
  };

  const handleDeleteTodo = (todoId: string) => {
    void cancelTodoReminder(allTodos.find((todo) => todo.id === todoId));
    if (customTodos.some((todo) => todo.id === todoId)) {
      setCustomTodos((prev) => prev.filter((todo) => todo.id !== todoId));
    } else {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          extractedTodos: item.extractedTodos?.filter((todo) => todo.id !== todoId),
        }))
      );
    }

    showToast('待办已删除', 'info');
  };

  const handleClearCompletedTodos = () => {
    const completedCount = allTodos.filter((todo) => todo.completed).length;
    if (completedCount === 0) {
      showToast('当前没有已完成待办', 'info');
      return;
    }

    allTodos.filter((todo) => todo.completed).forEach((todo) => {
      void cancelTodoReminder(todo);
    });
    setCustomTodos((prev) => prev.filter((todo) => !todo.completed));
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        extractedTodos: item.extractedTodos?.filter((todo) => !todo.completed),
      }))
    );
    showToast(`已清理 ${completedCount} 项已完成待办`);
  };

  const handleResetWorkspace = () => {
    const shouldReset = window.confirm(
      '这会清除本机保存的待办、笔记和配置，并恢复演示数据。是否继续？'
    );
    if (!shouldReset) return;

    setItems(INITIAL_INGEST_ITEMS);
    setCustomTodos([]);
    setSelectedNoteId(null);
    setFocusedItemId(null);
    setGemmaConfig({
      mode: 'local_gemma',
      localEndpoint: 'http://localhost:11434',
      modelTag: 'gemma4:latest',
      zeroCloudPrivacy: true,
      quantization: '4-bit NPU (Mobile)',
      isConnected: false,
      lastPingStatus: '尚未测试本地模型连接',
    });
    setObsidianConfig({
      vaultName: 'MyLifeVault',
      notesFolder: 'Inbox/记言Todo/',
      dailyNotesFolder: 'DailyNotes/',
      autoWikilinks: true,
      deepLinkProtocol: true,
      defaultTags: ['#记言Todo', '#本地提取'],
    });
    showToast('已恢复演示数据');
  };

  // Save new session (e.g. from live call or quick ingest)
  const handleSaveIngestItem = (newItem: IngestItem) => {
    setItems((prev) => [newItem, ...prev]);
    if (newItem.status === 'raw') {
      handleTriggerAiProcess(newItem);
    } else {
      showToast('已成功录入并沉淀为待办与知识库');
    }
  };

  const handleImportCallRecording = async () => {
    if (!isNativeAndroid) {
      showToast('通话录音导入只在实际安装的安卓应用中可用', 'info');
      return;
    }

    try {
      const picked = await VoxFlowNative.pickAudioFile();
      const newItem: IngestItem = {
        id: `call-recording-${Date.now()}`,
        channel: 'phone',
        sender: picked.fileName || '通话录音',
        timestamp: '刚刚',
        rawContent: `[系统通话录音]\n文件：${picked.fileName}\n\n尚未补充转写文本。请播放录音并填写内容后再提取待办。`,
        language: 'zh',
        status: 'raw',
        callRecordingUrl: Capacitor.convertFileSrc(picked.path),
      };
      setItems((previous) => [newItem, ...previous]);
      showToast('通话录音已导入，可播放并补充转写');
    } catch (error) {
      console.warn('Audio import failed:', error);
      showToast('未导入通话录音', 'info');
    }
  };

  const handleUpdateIngestContent = (itemId: string, rawContent: string) => {
    const item = itemsRef.current.find((currentItem) => currentItem.id === itemId);
    if (!item) return;

    const updatedItem: IngestItem = {
      ...item,
      rawContent,
      status: 'raw',
      summary: undefined,
      extractedTodos: undefined,
      knowledgeNote: undefined,
      todosCount: 0,
    };
    setItems((previous) =>
      previous.map((currentItem) => (currentItem.id === itemId ? updatedItem : currentItem))
    );
    void handleTriggerAiProcess(updatedItem);
  };

  // Integrate native sync hook
  const nativeSync = useNativeSync({
    setItems,
    itemsRef,
    onProcessItem: (item) => void handleTriggerAiProcess(item),
    onSetCallReviewItem: setCallReviewItem,
    showToast,
  });

  const saveGeneratedFile = async (
    fileName: string,
    content: string,
    mimeType = 'text/markdown;charset=utf-8'
  ) => {
    if (isNativeAndroid) {
      const result = await VoxFlowNative.saveTextFile({
        fileName,
        content,
        mimeType,
      });
      showToast(`已保存到 ${result.location}`);
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`已生成并下载：${fileName}`);
  };

  const handleExportBackup = async () => {
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const backup = {
      app: 'VoxFlow Todo',
      version: 1,
      exportedAt: now.toISOString(),
      items,
      customTodos,
      gemmaConfig,
      obsidianConfig,
    };

    try {
      await saveGeneratedFile(
        `VoxFlow-backup-${stamp}.json`,
        JSON.stringify(backup, null, 2),
        'application/json;charset=utf-8'
      );
    } catch {
      showToast('备份导出失败，请检查存储状态', 'info');
    }
  };

  const handleImportBackup = async () => {
    if (!isNativeAndroid) {
      showToast('备份导入只在实际安装的安卓应用中可用', 'info');
      return;
    }

    try {
      const picked = await VoxFlowNative.pickTextFile();
      const backup = JSON.parse(picked.content);
      if (backup?.app !== 'VoxFlow Todo' || !Array.isArray(backup.items)) {
        throw new Error('不是有效的 VoxFlow 备份文件');
      }

      setItems(backup.items);
      setCustomTodos(Array.isArray(backup.customTodos) ? backup.customTodos : []);
      if (backup.gemmaConfig) {
        setGemmaConfig((previous) => ({
          ...previous,
          ...backup.gemmaConfig,
          isConnected: false,
          lastPingStatus: '已导入配置，请重新测试连接',
        }));
      }
      if (backup.obsidianConfig) {
        setObsidianConfig((previous) => ({ ...previous, ...backup.obsidianConfig }));
      }

      const pendingReminders = [
        ...(backup.items as IngestItem[]).flatMap((item) => item.extractedTodos || []),
        ...(Array.isArray(backup.customTodos) ? backup.customTodos : []),
      ].filter((todo: ExtractedTodo) => todo.reminderAt && !todo.completed);

      await Promise.all(
        pendingReminders.map((todo) =>
          scheduleTodoReminder(todo).catch(() => undefined)
        )
      );
      showToast(`已从 ${picked.fileName} 恢复备份`);
    } catch (error) {
      console.warn('Backup import failed:', error);
      showToast('备份导入失败，请确认文件格式', 'info');
    }
  };

  // Obsidian Deep Link opening: obsidian://new?vault=Vault&file=Path&content=Encoded
  const handleOpenObsidianDeepLink = async (note: KnowledgeNote) => {
    if (!obsidianConfig.deepLinkProtocol) {
      showToast('请先在 Obsidian 设置中启用深链协议', 'info');
      return;
    }

    const vault = encodeURIComponent(obsidianConfig.vaultName || 'MyVault');
    const folder = obsidianConfig.notesFolder.replace(/^\/|\/$/g, '');
    const fileName = encodeURIComponent(note.title.replace(/[\\/:*?"<>|]/g, '_'));
    const content = encodeURIComponent(note.obsidianMarkdown);

    const deepLinkUrl = `obsidian://new?vault=${vault}&file=${folder ? folder + '/' : ''}${fileName}&content=${content}`;
    
    if (isNativeAndroid) {
      try {
        await VoxFlowNative.openExternalUrl({ url: deepLinkUrl });
        showToast('正在唤起 Obsidian 客户端');
        return;
      } catch {
        showToast('未找到可处理 obsidian:// 的应用，请先安装 Obsidian', 'info');
        return;
      }
    }

    window.location.href = deepLinkUrl;
    showToast('正在通过 obsidian:// 协议唤起本地 Obsidian 客户端');
  };

  // Download markdown file
  const handleDownloadMarkdownFile = async (note: KnowledgeNote) => {
    const fileName = `${note.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    try {
      await saveGeneratedFile(fileName, note.obsidianMarkdown);
    } catch {
      showToast('保存笔记失败，请检查设备存储权限', 'info');
    }
  };

  // Export all pending todos to Obsidian daily note
  const handleExportTodosToDailyNote = async () => {
    const today = new Date().toISOString().split('T')[0];
    const pending = allTodos.filter((t) => !t.completed);

    const dailyNoteMd = `---
title: "每日待办汇总 - ${today}"
date: ${today}
type: "daily_todo_rollup"
source: "记言Todo (VoxFlow)"
tags:
  - "#待办/Daily"
  - "#记言Todo"
---

# 📅 每日待办汇总 (${today})

> **生成引擎**: 记言 Todo · 本地提取  
> **未结事项**: ${pending.length} 项  

## ✅ 今日执行清单
${pending.map((t) => `- [ ] **${t.title}** 📅 ${t.dueDate} (${t.priority === 'high' ? '🔥高优' : '常规'}, 来源: ${t.sender || t.channel})`).join('\n')}

---
*自动生成于 ${new Date().toLocaleTimeString()}*
`;

    try {
      await saveGeneratedFile(`Daily-${today}.md`, dailyNoteMd);
    } catch {
      showToast('导出每日待办失败，请检查设备存储状态', 'info');
    }
  };

  // Render sub-views
  const renderCurrentView = () => {
    switch (activeTab) {
      case 'capture':
        return (
          <ChannelCapture
            items={items}
            onTriggerAiProcess={handleTriggerAiProcess}
            isProcessingId={isProcessingId}
            onSelectTodoTab={() => setActiveTab('todos')}
            onSelectKnowledgeTab={(noteId) => {
              if (noteId) setSelectedNoteId(noteId);
              setActiveTab('knowledge');
            }}
            onOpenQuickIngest={() => setShowQuickIngest(true)}
            onExportToObsidian={(item) => {
              if (item.knowledgeNote) void handleDownloadMarkdownFile(item.knowledgeNote);
            }}
            focusedItemId={focusedItemId}
            onFocusHandled={() => setFocusedItemId(null)}
            canSyncNative={Boolean(nativeSync.nativeStatus?.isNativeAndroid)}
            isNativeSyncing={nativeSync.isNativeSyncing}
            onSyncNativeData={nativeSync.handleSyncNativeData}
            onImportCallRecording={nativeSync.handleImportCallRecording}
            onUpdateIngestContent={handleUpdateIngestContent}
          />
        );
      case 'todos':
        return (
          <TodoPanel
            todos={allTodos}
            onToggleTodo={handleToggleTodo}
            onAddTodo={handleAddTodo}
            onUpdateTodo={handleUpdateTodo}
            onDeleteTodo={handleDeleteTodo}
            onClearCompleted={handleClearCompletedTodos}
            onExportTodosToDailyNote={handleExportTodosToDailyNote}
            onViewSource={(sourceId) => {
              setFocusedItemId(sourceId);
              setActiveTab('capture');
            }}
            onExecuteTodo={(todo) => setExecutingTodo(todo)}
          />
        );
      case 'knowledge':
        return (
          <KnowledgeBase
            notes={allKnowledgeNotes}
            obsidianConfig={obsidianConfig}
            selectedNoteId={selectedNoteId}
            onSelectNote={setSelectedNoteId}
            onOpenObsidianDeepLink={handleOpenObsidianDeepLink}
            onDownloadMarkdownFile={handleDownloadMarkdownFile}
          />
        );
      case 'monitor':
        return (
          <AppUsageMonitor
            sessions={nativeSync.appUsageSessions}
            currentPackageName={nativeSync.currentForegroundPackage}
            accessibilityBound={nativeSync.usageAccessibilityBound}
            nativeStatus={nativeSync.nativeStatus ?? EMPTY_NATIVE_STATUS}
            onRefresh={nativeSync.refreshAppUsage}
            onClear={nativeSync.clearAppUsage}
            onOpenAccessibilitySettings={nativeSync.handleOpenAccessibilitySettings}
            onPerformAction={nativeSync.performAccessibilityAction}
          />
        );
      case 'settings':
        return (
          <GemmaObsidianSettings
            gemmaConfig={gemmaConfig}
            onUpdateGemmaConfig={(cfg) => setGemmaConfig((prev) => ({ ...prev, ...cfg }))}
            obsidianConfig={obsidianConfig}
            onUpdateObsidianConfig={(cfg) => setObsidianConfig((prev) => ({ ...prev, ...cfg }))}
            onResetWorkspace={handleResetWorkspace}
            nativeStatus={nativeSync.nativeStatus ?? EMPTY_NATIVE_STATUS}
            isNativeSyncing={nativeSync.isNativeSyncing}
            onRefreshNativeStatus={nativeSync.refreshNativeCaptureStatus}
            onRequestNativePermissions={nativeSync.handleRequestNativePermissions}
            onOpenNotificationSettings={nativeSync.handleOpenNotificationSettings}
            onOpenAccessibilitySettings={nativeSync.handleOpenAccessibilitySettings}
            onSyncNativeData={nativeSync.handleSyncNativeData}
            onSetDesktopPetEnabled={nativeSync.handleSetDesktopPetEnabled}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onDeviceModel={onDeviceModel}
            onRefreshOnDeviceModel={refreshOnDeviceModelStatus}
            onDownloadOnDeviceModel={handleDownloadOnDeviceModel}
          />
        );
        case 'debug':
          return <DebugPanel />;
      default:
        return null;
    }
  };

  const useNativeMobileShell = viewMode === 'mobile' && (isNarrowViewport || isNativeAndroid);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Toast alert banner */}
      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm bg-slate-900/95 border border-indigo-500/50 shadow-2xl shadow-indigo-950/80 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 text-xs text-white animate-in backdrop-blur-md ${
            useNativeMobileShell ? 'top-14' : 'top-16'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {!useNativeMobileShell && (
        <Header
          viewMode={viewMode}
          setViewMode={setViewMode}
          gemmaConfig={gemmaConfig}
          obsidianConfig={obsidianConfig}
          onOpenSettings={(tab) => {
            setActiveTab('settings');
          }}
          onOpenQuickIngest={() => setShowQuickIngest(true)}
          onStartLiveCall={() => setShowLiveCall(true)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Main Content Area */}
      <main
        className={
          useNativeMobileShell
            ? 'flex-1 w-full'
            : 'flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8'
        }
      >
        {viewMode === 'mobile' ? (
          <AndroidPhoneFrame
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onStartLiveCall={() => setShowLiveCall(true)}
            onOpenQuickIngest={() => setShowQuickIngest(true)}
            pendingTodosCount={allTodos.filter((t) => !t.completed).length}
            fullscreen={useNativeMobileShell}
          >
            {renderCurrentView()}
          </AndroidPhoneFrame>
        ) : (
          <div>{renderCurrentView()}</div>
        )}
      </main>

      {/* Live Call Translation Floating Assistant Modal */}
      <LiveCallAssistant
        isOpen={showLiveCall}
        onClose={() => setShowLiveCall(false)}
        onSaveCallSession={handleSaveIngestItem}
        gemmaConfig={gemmaConfig}
        onDeviceModel={onDeviceModel}
      />

      <TodoExecuteModal
        todo={executingTodo}
        onClose={() => setExecutingTodo(null)}
        onPerformAction={nativeSync.performAccessibilityAction}
        onDone={(todo) => {
          if (!todo.completed) handleToggleTodo(todo.id);
          setExecutingTodo(null);
          showToast('待办执行完成');
        }}
      />

      <CallReviewModal
        item={callReviewItem}
        onClose={() => setCallReviewItem(null)}
        onConfirm={handleConfirmCallReview}
      />

      {/* Quick Ingest Modal */}
      <QuickIngestModal
        isOpen={showQuickIngest}
        onClose={() => setShowQuickIngest(false)}
        onSaveAndProcess={handleSaveIngestItem}
      />

      {!useNativeMobileShell && (
        <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>记言 Todo (VoxFlow) · 安卓端侧智能记录与待办中枢</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span>默认本地规则引擎 · 可选 Gemini / Ollama 增强</span>
              <span>•</span>
              <span>本地 Obsidian Markdown 双链知识库</span>
            </div>
          </div>
        </footer>
      )}

    </div>
  );
}
