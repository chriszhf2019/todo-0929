import { describe, it, expect, vi } from 'vitest';
import { processIngestItem } from '../aiPipeline';

// Mock dependencies of aiPipeline
vi.mock('../localModel', () => ({
  extractWithOnDevice: vi.fn().mockRejectedValue(new Error('no on-device')),
  extractWithOllama: vi.fn().mockRejectedValue(new Error('no local')),
}));
vi.mock('../localExtraction', () => ({
  extractLocally: vi.fn().mockReturnValue({
    summary: '自动提取摘要',
    category: '测试',
    todos: [
      { id: 't1', title: '跟进 A', dueDate: '本周内', priority: 'medium', tags: ['wechat'] },
    ],
    knowledgeBase: { title: '笔记', keyTakeaways: ['点1'], tags: ['#test'], obsidianMarkdown: '# md' },
  }),
}));

describe('aiPipeline', () => {
  it('falls back to local extraction when models unavailable', async () => {
    const item = {
      id: 'i1',
      channel: 'wechat',
      sender: '张三',
      timestamp: '刚刚',
      rawContent: '请明天把报告发给我',
      status: 'raw',
    } as any;

    const setItems = vi.fn();
    const setIsProcessingId = vi.fn();
    const showToast = vi.fn();
    const gemmaConfig = { mode: 'local_gemma', localEndpoint: 'http://localhost:11434', modelTag: 'gemma4:latest', isConnected: false };
    const onDeviceModel = { downloaded: false };

    await processIngestItem(item, { setItems, setIsProcessingId, showToast, gemmaConfig, onDeviceModel });

    expect(setIsProcessingId).toHaveBeenCalledWith('i1');
    expect(setIsProcessingId).toHaveBeenCalledWith(null);
    expect(setItems).toHaveBeenCalled();
  });
});
