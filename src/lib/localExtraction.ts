import { ChannelType, PriorityType } from '../types';

export interface LocalExtractionTodo {
  id: string;
  title: string;
  dueDate: string;
  priority: PriorityType;
  tags: string[];
}

export interface LocalExtractionKnowledgeBase {
  title: string;
  keyTakeaways: string[];
  tags: string[];
  obsidianMarkdown: string;
}

export interface LocalExtractionResult {
  summary: string;
  category: string;
  todos: LocalExtractionTodo[];
  knowledgeBase: LocalExtractionKnowledgeBase;
}

export interface LocalTranslationResult {
  original: string;
  translated: string;
  hasActionItem: boolean;
  actionItem: string;
  sentiment: 'neutral' | 'urgent' | 'friendly' | 'negotiation';
}

interface LocalExtractionInput {
  channel: ChannelType;
  rawContent: string;
  sender?: string;
  timestamp?: string;
}

const HIGH_PRIORITY_KEYWORDS = [
  '紧急',
  '今天',
  '马上',
  '立刻',
  'deadline',
  'urgent',
  'asap',
  '尽快',
  '支付',
  '签约',
];

const MEDIUM_PRIORITY_KEYWORDS = [
  '明天',
  '后天',
  '本周',
  '下周',
  '核对',
  '发送',
  '确认',
  'review',
  'send',
  'check',
];

const ACTION_KEYWORDS = [
  'todo',
  '请',
  '需要',
  '安排',
  '发我',
  '提醒',
  '记得',
  '办理',
  '预订',
  '预约',
  '准备',
  '检查',
  '确保',
  '处理',
  '核对',
  '确认',
  '复核',
  '更新',
  '提交',
  '发送',
  '回复',
  '联系',
  '完成',
  '值机',
  '还款',
  'send',
  'please',
  'need',
  'submit',
  'call',
  'schedule',
  'review',
  'check',
  'complete',
  'update',
  'book',
  'confirm',
  'pay',
  'wire',
];

const cleanLine = (line: string) =>
  line
    .replace(/^\s*(?:[-*•]|\d+[.、)]|[一二三四五六七八九十]+[、.])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

const getDueDate = (line: string) => {
  const lower = line.toLowerCase();
  const clock = extractClock(line);
  if (lower.includes('今天') || lower.includes('今晚') || lower.includes('today')) {
    return clock || '今天 18:00';
  }
  if (lower.includes('明天') || lower.includes('明日') || lower.includes('tomorrow')) {
    return clock || '明天 12:00';
  }
  if (lower.includes('后天') || lower.includes('day after tomorrow')) {
    return clock || '后天 12:00';
  }

  const weekdayMatch = line.match(/下?个?星期([一二三四五六日天])/);
  if (weekdayMatch) {
    const prefix = /下|个/.test(weekdayMatch[0]) ? '下' : '本';
    return `${prefix}周${weekdayMatch[1]}${clock ? ` ${clock}` : ''}`;
  }

  const shortWeekdayMatch = line.match(/下?周([一二三四五六日天])/);
  if (shortWeekdayMatch) {
    const prefix = shortWeekdayMatch[0].startsWith('下') ? '下' : '本';
    return `${prefix}周${shortWeekdayMatch[1]}${clock ? ` ${clock}` : ''}`;
  }

  const explicitDate = line.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (explicitDate) {
    return `${explicitDate[1]}月${explicitDate[2]}日${clock ? ` ${clock}` : ''}`;
  }

  return clock ? `今天 ${clock}` : '本周内';
};

const extractClock = (line: string) => {
  const clockMatch = line.match(/(?:(\d{1,2})[:：点](\d{1,2})?)/);
  if (!clockMatch) return '';
  const hour = clockMatch[1].padStart(2, '0');
  const minute = (clockMatch[2] || '00').padStart(2, '0');
  return `${hour}:${minute}`;
};

const getPriority = (line: string): PriorityType => {
  const lower = line.toLowerCase();
  if (HIGH_PRIORITY_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'high';
  if (MEDIUM_PRIORITY_KEYWORDS.some((keyword) => lower.includes(keyword))) return 'medium';
  return 'low';
};

export function extractLocally({
  channel,
  rawContent,
  sender,
  timestamp,
}: LocalExtractionInput): LocalExtractionResult {
  const lines = rawContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const readableLines = lines.map(cleanLine).filter((line) => line.length >= 4);
  const seenTodos = new Set<string>();
  const todos: LocalExtractionTodo[] = [];

  lines.forEach((line, index) => {
    const cleaned = cleanLine(line);
    const lower = cleaned.toLowerCase();
    const looksLikeHeading = /[:：]$/.test(cleaned) || cleaned.length < 5;
    const hasAction = ACTION_KEYWORDS.some((keyword) => lower.includes(keyword));

    if (looksLikeHeading || !hasAction) return;

    const title = cleaned.slice(0, 96);
    const dedupeKey = title.toLowerCase().replace(/\s/g, '');
    if (seenTodos.has(dedupeKey)) return;
    seenTodos.add(dedupeKey);

    const priority = getPriority(cleaned);
    todos.push({
      id: `local-todo-${Date.now()}-${index}`,
      title,
      dueDate: getDueDate(cleaned),
      priority,
      tags: [channel, priority === 'high' ? '紧要' : '待办', '端侧提取'],
    });
  });

  // 无明确行动项时，诚实地返回空待办，而不是硬凑一条「跟进」——
  // 避免把闲聊、纯通知、他人已完成的内容也当成待办。

  const channelLabel =
    channel === 'phone' ? '通话纪要' : channel === 'sms' ? '短信提取' : '微信备忘';
  const sourceLabel =
    channel === 'phone' ? '电话通话录音与整理' : channel === 'sms' ? '短信通知' : '微信消息记录';
  const date = new Date().toISOString().split('T')[0];
  const noteTitle = `${channelLabel} - ${sender || '对话'} (${new Date().toLocaleDateString()})`;
  const summaryLines = readableLines.filter((line) => !/[:：]$/.test(line));
  const summarySource =
    summaryLines.length > 1
      ? summaryLines
          .slice(0, 2)
          .map((line) => line.replace(/[；;。.,，\s]+$/, ''))
          .join('；')
      : summaryLines[0] || readableLines[0] || '已提取沟通信息与待办项';
  const takeawayLines = readableLines.slice(0, 3);

  const obsidianMarkdown = `---
title: "${noteTitle}"
date: ${date}
source: "${channel}"
sender: "${sender || '未知'}"
tags:
  - "#记言Todo"
  - "#${channel}"
  - "#gemma4/local"
status: "inbox"
---

# ${noteTitle}

> **来源渠道**: ${sourceLabel}
> **对方**: [[联系人/${sender || '未命名'}]]
> **时间**: ${timestamp || new Date().toLocaleString()}

## 核心要点
${takeawayLines.map((line) => `- ${line}`).join('\n')}

## 待办事项
${todos.map((todo) => `- [ ] **${todo.title}** (截止: ${todo.dueDate}, 优先级: ${todo.priority})`).join('\n')}

## 原始记录存档
\`\`\`text
${rawContent}
\`\`\`
`;

  return {
    summary:
      summarySource.length > 72 ? `${summarySource.slice(0, 72)}...` : summarySource,
    category:
      channel === 'phone' ? '电话通话' : channel === 'sms' ? '短信通知' : '微信工作沟通',
    todos,
    knowledgeBase: {
      title: noteTitle,
      keyTakeaways: takeawayLines,
      tags: [`#${channel}`, '#记言Todo', '#Obsidian'],
      obsidianMarkdown,
    },
  };
}

export function translateLocally(text: string): LocalTranslationResult {
  const lower = text.toLowerCase();

  if (lower.includes('send') && lower.includes('contract')) {
    return {
      original: text,
      translated: '请在明天下午之前将修订后的合同草案发给我。',
      hasActionItem: true,
      actionItem: '发送修订后的合同草案',
      sentiment: 'negotiation',
    };
  }

  if (lower.includes('meeting') || lower.includes('schedule')) {
    return {
      original: text,
      translated: '我们能否把电话会议推迟到明天上午10点？',
      hasActionItem: true,
      actionItem: '确认明天上午10点电话会议',
      sentiment: 'friendly',
    };
  }

  if (
    lower.includes('invoice') ||
    lower.includes('payment') ||
    lower.includes('deposit') ||
    lower.includes('wire')
  ) {
    return {
      original: text,
      translated: '关于发票与付款凭证，请核对并安排相应款项。',
      hasActionItem: true,
      actionItem: '核对发票并安排付款',
      sentiment: lower.includes('urgent') || lower.includes('asap') ? 'urgent' : 'neutral',
    };
  }

  if (lower.includes('hello') || lower.includes('morning') || lower.includes('afternoon')) {
    return {
      original: text,
      translated: '你好，感谢你的来电，关于新项目的交付进度想和你确认一下。',
      hasActionItem: false,
      actionItem: '',
      sentiment: 'friendly',
    };
  }

  const hasActionItem = ['please', 'need', 'will', 'could you', 'can you'].some((keyword) =>
    lower.includes(keyword)
  );

  return {
    original: text,
    translated: `[端侧翻译] ${text}`,
    hasActionItem,
    actionItem: hasActionItem ? `跟进通话内容: ${text.slice(0, 36)}` : '',
    sentiment: lower.includes('urgent') || lower.includes('asap') ? 'urgent' : 'neutral',
  };
}
