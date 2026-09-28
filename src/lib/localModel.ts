import { httpGetJson, httpPostJson } from './httpClient';
import { isNativeAndroid, VoxFlowNative } from './nativeBridge';
import { LocalExtractionResult, LocalTranslationResult } from './localExtraction';

interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

const normalizeEndpoint = (endpoint: string) => endpoint.replace(/\/+$/, '');

const buildExtractionPrompt = ({
  channel,
  sender,
  timestamp,
  rawContent,
}: {
  channel: 'phone' | 'sms' | 'wechat';
  sender: string;
  timestamp: string;
  rawContent: string;
}) => `你是用户的个人助理，负责从手机沟通记录里判别「哪些事情需要用户本人后续跟进或行动」。

请分析下面的${channel}记录：

来源：${sender}
时间：${timestamp}
内容：
"""
${rawContent}
"""

判别原则（非常重要，逐条遵守）：
1. 只输出「需要用户本人后续行动或跟进」的事项。
2. 纯信息告知、闲聊、寒暄、他人已完成的事项、与用户无关的群聊，一律不要生成待办。
3. todos 可以是空数组 []——如果没有需要用户跟进的事，就输出 []，不要硬凑。
4. priority 按「紧急性 × 重要性」判断，不要只因为出现「明天/发送」等词就标 high。

只输出严格 JSON：
{
  "summary": "一到两句摘要",
  "category": "分类",
  "todos": [
    {
      "id": "唯一字符串",
      "title": "具体可执行的行动项",
      "dueDate": "截止时间或待确认",
      "priority": "high | medium | low",
      "tags": ["标签"]
    }
  ],
  "knowledgeBase": {
    "title": "笔记标题",
    "keyTakeaways": ["要点"],
    "tags": ["#标签"],
    "obsidianMarkdown": "完整 Markdown 笔记"
  }
}`;

const buildTranslationPrompt = (text: string) => `你是实时通话翻译助手。请把下面的英文通话语音翻译成自然流畅的中文，并判断是否包含行动项或截止时间。

输入原文："${text}"

只输出严格 JSON：
{
  "original": "原文",
  "translated": "中文翻译",
  "hasActionItem": true或false,
  "actionItem": "如果有行动项请简述（如：周五前发送报价单），否则为空字符串",
  "sentiment": "neutral | urgent | friendly | negotiation"
}`;

// Small on-device models often wrap JSON in markdown fences or add prose.
// Extract the first balanced { ... } block before parsing.
const extractJson = (text: string): unknown => {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned) as unknown;
};

export const pingOllama = async (endpoint: string) => {
  const response = await httpGetJson(`${normalizeEndpoint(endpoint)}/api/tags`, 5000);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = response.data as OllamaTagsResponse;
  return (data.models || []).map((model) => model.name || model.model || '').filter(Boolean);
};

export const extractWithOllama = async ({
  endpoint,
  modelTag,
  channel,
  sender,
  timestamp,
  rawContent,
}: {
  endpoint: string;
  modelTag: string;
  channel: 'phone' | 'sms' | 'wechat';
  sender: string;
  timestamp: string;
  rawContent: string;
}): Promise<LocalExtractionResult> => {
  const prompt = buildExtractionPrompt({ channel, sender, timestamp, rawContent });

  const response = await httpPostJson(
    `${normalizeEndpoint(endpoint)}/api/generate`,
    {
      model: modelTag,
      prompt,
      stream: false,
      format: 'json',
    },
    120000
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const payload = response.data as OllamaGenerateResponse;
  if (payload.error) throw new Error(payload.error);
  if (!payload.response) throw new Error('Ollama returned an empty response');

  const parsed = JSON.parse(payload.response) as LocalExtractionResult;
  if (!parsed.summary || !Array.isArray(parsed.todos) || !parsed.knowledgeBase) {
    throw new Error('Ollama returned an invalid extraction result');
  }

  return parsed;
};

export const extractWithOnDevice = async ({
  channel,
  sender,
  timestamp,
  rawContent,
}: {
  channel: 'phone' | 'sms' | 'wechat';
  sender: string;
  timestamp: string;
  rawContent: string;
}): Promise<LocalExtractionResult> => {
  if (!isNativeAndroid) throw new Error('端侧推理仅在安卓应用可用');

  const prompt = buildExtractionPrompt({ channel, sender, timestamp, rawContent });
  const result = await VoxFlowNative.runOnDeviceInference({ prompt, maxTokens: 512 });

  const parsed = extractJson(result.text) as LocalExtractionResult;
  if (!parsed.summary || !Array.isArray(parsed.todos) || !parsed.knowledgeBase) {
    throw new Error('端侧模型返回了无效的提取结果');
  }
  return parsed;
};

export const extractWithGeminiCloud = async ({
  apiKey,
  channel,
  sender,
  timestamp,
  rawContent,
}: {
  apiKey: string;
  channel: 'phone' | 'sms' | 'wechat';
  sender: string;
  timestamp: string;
  rawContent: string;
}): Promise<LocalExtractionResult> => {
  const prompt = buildExtractionPrompt({ channel, sender, timestamp, rawContent });
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini 返回 ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 返回为空');
  const parsed = extractJson(text) as LocalExtractionResult;
  if (!parsed.summary || !Array.isArray(parsed.todos) || !parsed.knowledgeBase) {
    throw new Error('Gemini 返回了无效的提取结果');
  }
  return parsed;
};

export const translateWithOllama = async ({
  endpoint,
  modelTag,
  text,
}: {
  endpoint: string;
  modelTag: string;
  text: string;
}): Promise<LocalTranslationResult> => {
  const prompt = buildTranslationPrompt(text);

  const response = await httpPostJson(
    `${normalizeEndpoint(endpoint)}/api/generate`,
    {
      model: modelTag,
      prompt,
      stream: false,
      format: 'json',
    },
    60000
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const payload = response.data as OllamaGenerateResponse;
  if (payload.error) throw new Error(payload.error);
  if (!payload.response) throw new Error('Ollama returned an empty response');

  const parsed = JSON.parse(payload.response) as LocalTranslationResult;
  if (!parsed.translated) throw new Error('Ollama returned an invalid translation result');

  return {
    original: parsed.original || text,
    translated: parsed.translated,
    hasActionItem: Boolean(parsed.hasActionItem),
    actionItem: parsed.actionItem || '',
    sentiment: parsed.sentiment || 'neutral',
  };
};

export const translateWithOnDevice = async (text: string): Promise<LocalTranslationResult> => {
  if (!isNativeAndroid) throw new Error('端侧推理仅在安卓应用可用');

  const prompt = buildTranslationPrompt(text);
  const result = await VoxFlowNative.runOnDeviceInference({ prompt, maxTokens: 256 });

  const parsed = extractJson(result.text) as LocalTranslationResult;
  if (!parsed.translated) throw new Error('端侧模型返回了无效的翻译结果');

  return {
    original: parsed.original || text,
    translated: parsed.translated,
    hasActionItem: Boolean(parsed.hasActionItem),
    actionItem: parsed.actionItem || '',
    sentiment: parsed.sentiment || 'neutral',
  };
};
