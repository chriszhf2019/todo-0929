export type ChannelType = 'phone' | 'sms' | 'wechat';

export type PriorityType = 'high' | 'medium' | 'low';

export interface ExtractedTodo {
  id: string;
  sourceId: string;
  title: string;
  dueDate: string;
  priority: PriorityType;
  completed: boolean;
  channel: ChannelType;
  sender?: string;
  senderPhone?: string;
  sourcePackage?: string;
  tags: string[];
  createdAt: string;
  reminderAt?: string;
  reminderNotificationId?: number;
}

export interface KnowledgeNote {
  id: string;
  sourceId: string;
  title: string;
  category: string;
  channel: ChannelType;
  sender: string;
  date: string;
  keyTakeaways: string[];
  tags: string[];
  obsidianMarkdown: string;
  rawSnippet: string;
}

export interface IngestItem {
  id: string;
  channel: ChannelType;
  sender: string;
  senderPhone?: string;
  sourcePackage?: string;
  timestamp: string;
  rawContent: string;
  audioDuration?: string;
  isEnglishCall?: boolean;
  language?: 'zh' | 'en' | 'bilingual';
  status: 'raw' | 'processed';
  summary?: string;
  todosCount?: number;
  extractedTodos?: ExtractedTodo[];
  knowledgeNote?: KnowledgeNote;
  callRecordingUrl?: string;
  extractionEngine?: 'local-ollama' | 'gemini' | 'local-rules' | 'on-device';
}

export interface LiveSubtitleLine {
  id: string;
  speaker: 'Caller' | 'User';
  englishText: string;
  chineseText: string;
  timestamp: string;
  hasActionItem?: boolean;
  actionItem?: string;
}

export interface GemmaConfig {
  mode: 'hybrid' | 'local_gemma' | 'cloud_gemini';
  localEndpoint: string;
  modelTag: string;
  geminiApiKey?: string;
  zeroCloudPrivacy: boolean;
  quantization: '4-bit NPU (Mobile)' | '8-bit GGUF' | 'FP16 Server';
  isConnected: boolean;
  lastPingStatus?: string;
}

export interface ObsidianConfig {
  vaultName: string;
  notesFolder: string;
  dailyNotesFolder: string;
  autoWikilinks: boolean;
  deepLinkProtocol: boolean;
  defaultTags: string[];
}

export interface NamingOption {
  chineseName: string;
  englishName: string;
  tagline: string;
  vibe: string;
  recommendedRole: string;
}
