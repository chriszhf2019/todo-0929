import { IngestItem, ExtractedTodo, KnowledgeNote, ChannelType } from '../types';
import { LocalExtractionResult, extractLocally } from './localExtraction';
// Worker wrapper will be dynamically imported
type WorkerResponse<T> = { id: string; success: boolean; result?: T; error?: string };
let extractionWorker: Worker | null = null;
const ensureWorker = () => {
  if (extractionWorker) return extractionWorker;
  // @ts-ignore
  extractionWorker = new Worker(new URL('./extraction.worker.ts', import.meta.url), { type: 'module' });
  return extractionWorker;
};

const runExtractLocally = async (payload: { channel: string; rawContent: string; sender?: string; timestamp?: string }) => {
  // 非浏览器环境（测试 / 旧 WebView）没有 Worker：直接主线程同步提取，作为兜底
  if (typeof Worker === 'undefined') {
    return extractLocally({
      channel: payload.channel as ChannelType,
      rawContent: payload.rawContent,
      sender: payload.sender,
      timestamp: payload.timestamp,
    });
  }
  const worker = ensureWorker();
  return new Promise<LocalExtractionResult>((resolve, reject) => {
    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as WorkerResponse<LocalExtractionResult>;
      if (data.id !== id) return;
      worker.removeEventListener('message', onMessage);
      if (data.success && data.result) resolve(data.result);
      else reject(new Error(data.error || 'worker error'));
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ id, action: 'extract', payload });
  });
};
import { extractWithOnDevice, extractWithOllama, extractWithGeminiCloud } from './localModel';

type SetItems = (updater: (prev: IngestItem[]) => IngestItem[]) => void;

export const applyExtractionResult = (
  item: IngestItem,
  data: LocalExtractionResult,
  setItems: SetItems,
  engine: IngestItem['extractionEngine'] = 'local-rules'
): number => {
  const formattedTodos: ExtractedTodo[] = data.todos.map((todo, index) => ({
    id: todo.id || `todo-${Date.now()}-${index}`,
    sourceId: item.id,
    title: todo.title || '跟进事项',
    dueDate: todo.dueDate || '本周内',
    priority: todo.priority || 'medium',
    completed: false,
    channel: item.channel,
    sender: item.sender,
    senderPhone: item.senderPhone,
    sourcePackage: item.sourcePackage,
    tags: todo.tags || [item.channel, '本地提取'],
    createdAt: '刚刚',
  }));

  const newKnowledgeNote: KnowledgeNote = {
    id: `kn-${item.id}`,
    sourceId: item.id,
    title: data.knowledgeBase.title || `${item.sender} - 沟通整理笔记`,
    category:
      data.category ||
      (item.channel === 'phone'
        ? '通话纪要'
        : item.channel === 'sms'
        ? '短信提炼'
        : '微信备忘'),
    channel: item.channel,
    sender: item.sender,
    date: new Date().toISOString().split('T')[0],
    keyTakeaways: data.knowledgeBase.keyTakeaways || [data.summary],
    tags: data.knowledgeBase.tags || [`#${item.channel}`, '#本地提取'],
    obsidianMarkdown:
      data.knowledgeBase.obsidianMarkdown || `# ${item.sender} 沟通记录\n\n- ${data.summary}`,
    rawSnippet: `${item.rawContent.slice(0, 180)}...`,
  };

  setItems((prev) =>
    prev.map((currentItem) =>
      currentItem.id === item.id
        ? {
            ...currentItem,
            status: 'processed',
            summary: data.summary,
            todosCount: formattedTodos.length,
            extractedTodos: formattedTodos,
            knowledgeNote: newKnowledgeNote,
            extractionEngine: engine,
          }
        : currentItem
    )
  );

  return formattedTodos.length;
};

export const processIngestItem = async (
  item: IngestItem,
  opts: {
    setItems: SetItems;
    setIsProcessingId: (id: string | null) => void;
    showToast: (message: string, type?: 'success' | 'info') => void;
    gemmaConfig: { mode: string; localEndpoint: string; modelTag: string; isConnected?: boolean; geminiApiKey?: string };
    onDeviceModel: { downloaded?: boolean };
  }
): Promise<void> => {
  const { setItems, setIsProcessingId, showToast, gemmaConfig, onDeviceModel } = opts;
  setIsProcessingId(item.id);
  try {
    // 1. On-device
    if (onDeviceModel?.downloaded) {
      try {
        const onDeviceResult = await extractWithOnDevice({
          channel: item.channel,
          sender: item.sender,
          timestamp: item.timestamp,
          rawContent: item.rawContent,
        });
        const todoCount = applyExtractionResult(item, onDeviceResult, setItems, 'on-device');
        showToast(`端侧模型整理完成，提炼出 ${todoCount} 项待办`);
        return;
      } catch (e) {
        console.warn('On-device extraction failed, continuing:', e);
      }
    }

    // 2. Local Ollama
    if (gemmaConfig.mode !== 'cloud_gemini' && gemmaConfig.isConnected) {
      try {
        const localResult = await extractWithOllama({
          endpoint: gemmaConfig.localEndpoint,
          modelTag: gemmaConfig.modelTag,
          channel: item.channel,
          sender: item.sender || '',
          timestamp: item.timestamp,
          rawContent: item.rawContent,
        });
        const todoCount = applyExtractionResult(item, localResult, setItems, 'local-ollama');
        showToast(`本地模型整理完成，提炼出 ${todoCount} 项待办`);
        return;
      } catch (e) {
        console.warn('Local model extraction failed, continuing with app fallback:', e);
      }
    }

    // 2.5. 云端 Gemini 直连（手机直接调 Gemini，不依赖电脑 server）
    if (gemmaConfig.mode !== 'local_gemma' && gemmaConfig.geminiApiKey) {
      try {
        const geminiResult = await extractWithGeminiCloud({
          apiKey: gemmaConfig.geminiApiKey,
          channel: item.channel,
          sender: item.sender || '',
          timestamp: item.timestamp,
          rawContent: item.rawContent,
        });
        const todoCount = applyExtractionResult(item, geminiResult, setItems, 'gemini');
        showToast(`Gemini 判别完成，提炼出 ${todoCount} 项待办`);
        return;
      } catch (e) {
        console.warn('Gemini cloud extraction failed, continuing:', e);
      }
    }

    // 3. Remote API fallback
    try {
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: item.channel,
          rawContent: item.rawContent,
          sender: item.sender,
          timestamp: item.timestamp,
          modelMode: gemmaConfig.mode,
          localEndpoint: gemmaConfig.localEndpoint,
        }),
      });

      if (!response.ok) throw new Error(`处理服务返回 ${response.status}`);
      const result = await response.json();
      if (!result.success || !result.data) throw new Error(result.error || '处理结果无效');

      const engine: IngestItem['extractionEngine'] =
        typeof result.sourceEngine === 'string' && result.sourceEngine.toLowerCase().includes('gemini')
          ? 'gemini'
          : 'local-rules';
      const todoCount = applyExtractionResult(item, result.data as LocalExtractionResult, setItems, engine);
      showToast(`智能整理完成，提炼出 ${todoCount} 项待办并生成 Obsidian 笔记`);
      return;
    } catch (error) {
      console.warn('AI service unavailable, using browser-side extraction:', error);
      const localResult = await runExtractLocally({
        channel: item.channel,
        rawContent: item.rawContent,
        sender: item.sender,
        timestamp: item.timestamp,
      });
      const todoCount = applyExtractionResult(item, localResult, setItems, 'local-rules');
      showToast(`已使用端侧离线引擎提炼 ${todoCount} 项待办`, 'info');
    }
  } finally {
    setIsProcessingId(null);
  }
};
