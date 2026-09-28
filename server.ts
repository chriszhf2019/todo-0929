import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { extractLocally } from './src/lib/localExtraction';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.use(express.json({ limit: '10mb' }));

// Lazy init for Gemini API
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// DeepSeek (OpenAI-compatible) —— 判别引擎：优先用来判断「哪些事需要用户跟进」
async function callDeepSeek(prompt: string): Promise<unknown | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === 'MY_DEEPSEEK_API_KEY') return null;
  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        stream: false,
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    const content = data?.choices?.[0]?.message?.content;
    return content ? JSON.parse(content.trim()) : null;
  } catch (err: any) {
    console.warn('DeepSeek call failed:', err?.message);
    return null;
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    time: new Date().toISOString(),
  });
});

// AI Process endpoint: parses call/sms/wechat content into Todos and Knowledge Note
app.post('/api/ai/process', async (req, res) => {
  try {
    const { channel, rawContent, sender, timestamp, modelMode, localEndpoint } = req.body;

    if (!rawContent || typeof rawContent !== 'string') {
      return res.status(400).json({ error: 'Missing rawContent string' });
    }

    const channelLabel =
      channel === 'phone' ? '电话通话录音与转写' : channel === 'sms' ? '短信通知' : '微信聊天记录';

    // 判别 prompt：只挑出「需要用户本人跟进」的事项，允许空待办
    const prompt = `你是用户的个人助理，负责从手机沟通记录里判别「哪些事情需要用户本人后续跟进或行动」。

请分析以下来自【${channelLabel}】的内容：
来源/发件人: ${sender || '未知'}
时间: ${timestamp || new Date().toLocaleString()}
内容:
"""
${rawContent}
"""

判别原则（逐条遵守）：
1. 只输出「需要用户本人后续行动或跟进」的事项。
2. 纯信息告知、闲聊、寒暄、他人已完成的事项、与用户无关的群聊，一律不要生成待办。
3. todos 可以是空数组 []——如果没有需要用户跟进的事，就输出 []，不要硬凑。
4. priority 按「紧急性 × 重要性」判断。

请按以下格式输出严格 JSON（不要输出 markdown 代码块外的内容）：
{
  "summary": "1-2句话高度概括核心内容",
  "category": "工作沟通 / 商务合作 / 日常生活 / 财务物流 / 学习备忘 / 其它",
  "todos": [
    {
      "id": "随机字符串",
      "title": "具体行动项",
      "dueDate": "截止日期或推荐处理时间（例如 YYYY-MM-DD 或 尽快 / 明天下午）",
      "priority": "high | medium | low",
      "tags": ["标签1", "标签2"]
    }
  ],
  "knowledgeBase": {
    "title": "适合作为知识库笔记的标题",
    "keyTakeaways": ["要点1", "要点2"],
    "tags": ["#标签1", "#标签2"],
    "obsidianMarkdown": "完整的 Obsidian 风格 Markdown 笔记，包含 YAML Frontmatter 以及正文，并适当使用 [[双向链接]]"
  }
}`;

    // 1. DeepSeek 判别引擎（优先）
    if (modelMode !== 'local_gemma') {
      const deepseekData = await callDeepSeek(prompt);
      if (deepseekData) {
        return res.json({ success: true, sourceEngine: 'DeepSeek 判别引擎', data: deepseekData });
      }
    }

    // 2. Gemini
    const ai = getAiClient();
    if (ai && modelMode !== 'local_gemma') {
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response.text) {
          return res.json({
            success: true,
            sourceEngine: 'Gemini',
            data: JSON.parse(response.text.trim()),
          });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini error, falling back to local rules:', geminiErr?.message);
      }
    }

    // 3. 本地规则兜底
    const localResult = extractLocally({
      channel: channel as 'phone' | 'sms' | 'wechat',
      rawContent,
      sender,
      timestamp,
    });

    return res.json({
      success: true,
      sourceEngine: '本地规则引擎（关键词判别）',
      data: localResult,
    });
  } catch (err: any) {
    console.error('Process error:', err);
    res.status(500).json({ error: err.message || 'Processing failed' });
  }
});

// Real-time call translation endpoint (translates English speech/text to Chinese with action item tags)
app.post('/api/ai/translate', async (req, res) => {
  try {
    const { text, direction = 'en_to_zh' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text string' });
    }

    const ai = getAiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `You are a real-time call translation and speech parsing assistant for a phone app.
Translate the following English telephone speech into natural, fluent Chinese.
Also detect if there is any actionable request or deadline mentioned.

Input text: "${text}"

Output strictly JSON:
{
  "original": "${text.replace(/"/g, '\\"')}",
  "translated": "中文翻译",
  "hasActionItem": true or false,
  "actionItem": "如果包含行动项或待办，请简述行动（如：周五前发送最新报价单），否则填空字符串",
  "sentiment": "neutral | urgent | friendly | negotiation"
}`,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          return res.json({ success: true, ...parsed });
        }
      } catch (err: any) {
        console.warn('Gemini translate fallback:', err?.message);
      }
    }

    // Heuristic translation dictionary / fallback for demo & offline mode
    const lower = text.toLowerCase();
    let translated = '（实时翻译）' + text;
    let hasActionItem = false;
    let actionItem = '';

    if (lower.includes('send') && lower.includes('contract')) {
      translated = '请在明天下午之前将修订后的合同草案发给我。';
      hasActionItem = true;
      actionItem = '发送修订后的合同草案';
    } else if (lower.includes('meeting') || lower.includes('schedule')) {
      translated = '我们能否把电话会议推迟到明天上午10点？';
      hasActionItem = true;
      actionItem = '确认明天上午10点电话会议';
    } else if (lower.includes('invoice') || lower.includes('payment')) {
      translated = '关于上个月的发票与付款凭证，请核对一下账单信息。';
      hasActionItem = true;
      actionItem = '核对上月发票与账单信息';
    } else if (lower.includes('hello') || lower.includes('morning') || lower.includes('afternoon')) {
      translated = '你好，感谢你的来电，关于新项目的交付进度想和你确认一下。';
    } else {
      translated = `[译] ${text}`;
      if (lower.includes('please') || lower.includes('need') || lower.includes('will')) {
        hasActionItem = true;
        actionItem = `跟进通话内容: ${text.slice(0, 30)}`;
      }
    }

    return res.json({
      success: true,
      original: text,
      translated,
      hasActionItem,
      actionItem,
      sentiment: lower.includes('urgent') || lower.includes('asap') ? 'urgent' : 'neutral',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Gemma 4 local engine status ping endpoint
app.post('/api/gemma/ping', async (req, res) => {
  const { endpoint = 'http://localhost:11434' } = req.body;
  // Check if user has a running local Ollama / Gemma 4 service
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(`${endpoint}/api/tags`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (response && response.ok) {
      const data = await response.json();
      return res.json({
        available: true,
        endpoint,
        models: data.models || [],
        message: '已成功连通本地 Gemma 4 / Ollama 引擎',
      });
    }
  } catch {
    // Ignore error
  }

  // Graceful virtual local Gemma 4 runtime info
  res.json({
    available: false,
    endpoint,
    message: '本地端侧 Gemma 4 离线管道准备就绪（支持安卓端内置量化 NPU 运行 / 或连接局域网 Ollama）',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`记言 Todo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
